"""
inference_test.py
-----------------
Interactive and benchmark inference runner for Personal Finance SLM.
Tests real-time transaction categorization and financial query parsing.
Measures latency, token generation speed, and JSON parsing fidelity.
"""

import sys
import time
import json
import argparse
from pathlib import Path
from typing import Dict, Any, Optional

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

try:
    from peft import PeftModel
    PEFT_AVAILABLE = True
except ImportError:
    PEFT_AVAILABLE = False

sys.path.append(str(Path(__file__).resolve().parent.parent / "training"))
from formatting import format_chat_prompt
from evaluate import extract_json_payload

CURATED_TEST_CASES = [
    # Task A: Transaction Categorization
    {
        "task": "categorization",
        "description": "Swiggy order payment for dinner",
        "amount": 450.0,
        "expected": {"category": "Food", "transaction_type": "Expense"},
    },
    {
        "task": "categorization",
        "description": "Salary credited from Infosys Ltd to A/C XX4821",
        "amount": 85000.0,
        "expected": {"category": "Salary", "transaction_type": "Income"},
    },
    {
        "task": "categorization",
        "description": "Uber cab ride from airport terminal to home",
        "amount": 620.0,
        "expected": {"category": "Transportation", "transaction_type": "Expense"},
    },
    {
        "task": "categorization",
        "description": "Monthly 2BHK flat rent transfer to landlord via UPI",
        "amount": 28000.0,
        "expected": {"category": "Rent", "transaction_type": "Expense"},
    },
    {
        "task": "categorization",
        "description": "Blinkit quick delivery: brown bread, eggs, and butter",
        "amount": 340.0,
        "expected": {"category": "Groceries", "transaction_type": "Expense"},
    },
    {
        "task": "categorization",
        "description": "Quarterly dividend credited from ITC Ltd shares",
        "amount": 1250.0,
        "expected": {"category": "Investment", "transaction_type": "Income"},
    },
    {
        "task": "categorization",
        "description": "BESCOM monthly electricity bill payment",
        "amount": 1450.0,
        "expected": {"category": "Bills", "transaction_type": "Expense"},
    },
    # Task B: Query Understanding
    {
        "task": "query_understanding",
        "query": "How much did I spend on food last month?",
        "expected": {"intent": "category_spending", "category": "Food", "period": "previous_month", "operation": "sum"},
    },
    {
        "task": "query_understanding",
        "query": "What is my total income this month?",
        "expected": {"intent": "total_income", "period": "current_month", "operation": "sum"},
    },
    {
        "task": "query_understanding",
        "query": "Did I exceed my grocery budget this month?",
        "expected": {"intent": "budget_status", "category": "Groceries", "period": "current_month", "operation": "check"},
    },
    {
        "task": "query_understanding",
        "query": "Which category did I spend the most on this year?",
        "expected": {"intent": "highest_spending_category", "period": "current_year", "operation": "max"},
    },
    {
        "task": "query_understanding",
        "query": "Show my total savings for this month",
        "expected": {"intent": "savings_summary", "period": "current_month", "operation": "sum"},
    },
]


class SLMInferenceEngine:
    def __init__(
        self,
        adapter_path: str = "model/training/outputs/final_adapter",
        base_model_path: str = "google/gemma-3-1b-it",
    ):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.bfloat16 if (self.device == "cuda" and torch.cuda.is_bf16_supported()) else (torch.float16 if self.device == "cuda" else torch.float32)

        adapter_p = Path(adapter_path)
        if adapter_p.exists() and (adapter_p / "adapter_config.json").exists():
            print(f"[InferenceEngine] Loading fine-tuned LoRA adapter from {adapter_path}...")
            self.tokenizer = AutoTokenizer.from_pretrained(str(adapter_p), trust_remote_code=True)
            base = AutoModelForCausalLM.from_pretrained(
                base_model_path,
                torch_dtype=self.dtype,
                device_map="auto" if self.device == "cuda" else None,
                trust_remote_code=True,
            )
            if not PEFT_AVAILABLE:
                raise ImportError("peft package is required to load LoRA adapter.")
            self.model = PeftModel.from_pretrained(base, str(adapter_p))
        else:
            print(f"[InferenceEngine] Adapter not found at {adapter_path}; using base model {base_model_path}...")
            self.tokenizer = AutoTokenizer.from_pretrained(base_model_path, trust_remote_code=True)
            self.model = AutoModelForCausalLM.from_pretrained(
                base_model_path,
                torch_dtype=self.dtype,
                device_map="auto" if self.device == "cuda" else None,
                trust_remote_code=True,
            )

        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.model.eval()

    def categorize_transaction(self, description: str, amount: float) -> Dict[str, Any]:
        system_prompt = (
            "You are a personal finance assistant. Categorize the given financial transaction into one of: "
            "Food, Shopping, Transportation, Entertainment, Healthcare, Education, Bills, Rent, Groceries, Travel, Salary, Investment, Other. "
            "Determine whether it is an Expense or Income. Respond with valid JSON only."
        )
        user_input = f"Description: {description}\nAmount: {amount:.2f}"
        return self._generate_response(system_prompt, user_input)

    def parse_query(self, user_query: str) -> Dict[str, Any]:
        system_prompt = (
            "You are a personal finance assistant. Parse the user's natural language financial query into a structured JSON object "
            "containing intent (one of: total_expenses, total_income, category_spending, monthly_summary, date_range_summary, "
            "highest_spending_category, budget_status, savings_summary), category, period, and operation. Respond with valid JSON only."
        )
        return self._generate_response(system_prompt, user_query)

    def _generate_response(self, system_prompt: str, user_input: str) -> Dict[str, Any]:
        conversations = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ]
        prompt = format_chat_prompt(conversations, self.tokenizer, add_generation_prompt=True)
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        if self.device == "cuda":
            inputs = {k: v.cuda() for k, v in inputs.items()}

        start_time = time.perf_counter()
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=128,
                do_sample=False,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
            )
        elapsed_s = time.perf_counter() - start_time

        new_tokens = outputs[0][inputs["input_ids"].shape[1]:]
        response_text = self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
        parsed_json, is_valid = extract_json_payload(response_text)

        tokens_per_sec = len(new_tokens) / elapsed_s if elapsed_s > 0 else 0

        return {
            "parsed_json": parsed_json,
            "is_valid_json": is_valid,
            "raw_text": response_text,
            "latency_ms": round(elapsed_s * 1000, 2),
            "generated_tokens": len(new_tokens),
            "tokens_per_sec": round(tokens_per_sec, 1),
        }


def run_benchmark(engine: SLMInferenceEngine):
    print("=" * 70)
    print("RUNNING CURATED INFERENCE BENCHMARK")
    print("=" * 70)
    for idx, test_case in enumerate(CURATED_TEST_CASES, 1):
        task = test_case["task"]
        print(f"\n[Test Case {idx:02d}] Task: {task.upper()}")

        if task == "categorization":
            desc = test_case["description"]
            amt = test_case["amount"]
            print(f"  Input    : '{desc}' (Amount: ₹{amt:.2f})")
            result = engine.categorize_transaction(desc, amt)
        else:
            q = test_case["query"]
            print(f"  Input    : '{q}'")
            result = engine.parse_query(q)

        print(f"  Generated: {result['raw_text']}")
        print(f"  Parsed   : {json.dumps(result['parsed_json'], ensure_ascii=False)}")
        print(f"  Speed    : {result['latency_ms']} ms ({result['tokens_per_sec']} tokens/sec) | Valid JSON: {result['is_valid_json']}")
    print("=" * 70)


def run_interactive(engine: SLMInferenceEngine):
    print("=" * 70)
    print("INTERACTIVE SLM FINANCE ASSISTANT CLI")
    print("Type your financial query or transaction. (Type 'exit' or 'quit' to quit)")
    print("Examples:")
    print("  - How much did I spend on dining last month?")
    print("  - Txn: Zomato dinner Rs 480")
    print("=" * 70)

    while True:
        try:
            user_input = input("\nYou > ").strip()
            if user_input.lower() in ["exit", "quit", "q"]:
                break
            if not user_input:
                continue

            if user_input.lower().startswith("txn:") or " rs " in user_input.lower() or " inr " in user_input.lower():
                result = engine.categorize_transaction(user_input, 100.0)
            else:
                result = engine.parse_query(user_input)

            print(f"SLM [JSON]: {json.dumps(result['parsed_json'], indent=2)}")
            print(f"Metrics   : {result['latency_ms']} ms ({result['tokens_per_sec']} tok/s)")

        except KeyboardInterrupt:
            print("\nExiting...")
            break


def main():
    parser = argparse.ArgumentParser(description="Test inference on fine-tuned SLM")
    parser.add_argument("--adapter", "-a", type=str, default="model/training/outputs/final_adapter", help="Path to LoRA adapter")
    parser.add_argument("--base-model", "-b", type=str, default="google/gemma-3-1b-it", help="Base model identifier")
    parser.add_argument("--interactive", "-i", action="store_true", help="Launch interactive CLI prompt")
    args = parser.parse_args()

    engine = SLMInferenceEngine(adapter_path=args.adapter, base_model_path=args.base_model)
    if args.interactive:
        run_interactive(engine)
    else:
        run_benchmark(engine)


if __name__ == "__main__":
    main()

