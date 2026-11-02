"""
preprocess_dataset.py
---------------------
Preprocesses raw synthetic personal finance dataset for Small Language Model (SLM) training.
Performs:
  - Text normalization (whitespace, unicode cleaning, capitalization cleanup)
  - Numeric standardization (amounts rounded to 2 decimal places)
  - Instruction-tuning format transformation (ChatML / Alpaca / Instruction-Input-Output)
  - Metadata preservation for group-aware splitting and leakage prevention
  - Exports to model/data/processed/processed_dataset.jsonl
"""

import re
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List

CATEGORIZATION_SYSTEM_PROMPT = (
    "You are a privacy-preserving on-device personal finance assistant. "
    "Your task is to accurately categorize financial transactions into one of the following exact categories: "
    "Food, Shopping, Transportation, Entertainment, Healthcare, Education, Bills, Rent, Groceries, Travel, Salary, Investment, Other. "
    "Classify whether the transaction is an 'Expense' or 'Income'. "
    "Always output strictly valid JSON with keys 'category' and 'transaction_type'."
)

QUERY_UNDERSTANDING_SYSTEM_PROMPT = (
    "You are a privacy-preserving on-device personal finance assistant. "
    "Your task is to parse natural-language financial questions into structured queries. "
    "Identify the intent from the supported set: total_expenses, total_income, category_spending, monthly_summary, "
    "date_range_summary, highest_spending_category, budget_status, savings_summary. "
    "Extract the relevant category, temporal period, and mathematical operation. "
    "Always output strictly valid JSON."
)


def normalize_text(text: str) -> str:
    """Normalizes whitespace and removes unwanted unicode noise."""
    if not isinstance(text, str):
        return ""
    # Replace non-breaking spaces and irregular whitespace
    s = re.sub(r"[\u00A0\u2000-\u200B\u202F\u205F\u3000]", " ", text)
    # Collapse multiple spaces into one
    s = re.sub(r"\s+", " ", s).strip()
    return s


def preprocess_categorization_record(record: Dict[str, Any], record_idx: int) -> Dict[str, Any]:
    raw_inp = record["input"]
    raw_out = record["output"]

    desc = normalize_text(raw_inp["description"])
    amount = round(float(raw_inp["amount"]), 2)

    cat = raw_out["category"].strip()
    tx_type = raw_out["transaction_type"].strip()

    user_prompt = f"Description: {desc}\nAmount: {amount:.2f}"
    assistant_completion = json.dumps({"category": cat, "transaction_type": tx_type}, ensure_ascii=False)

    return {
        "id": f"slm_cat_{record_idx:06d}",
        "task": "categorization",
        "template_id": record.get("template_id", "cat_default"),
        "instruction": CATEGORIZATION_SYSTEM_PROMPT,
        "input": user_prompt,
        "output": assistant_completion,
        "conversations": [
            {"role": "system", "content": CATEGORIZATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": assistant_completion},
        ],
        "metadata": {
            "task": "categorization",
            "category": cat,
            "transaction_type": tx_type,
            "amount": amount,
            "template_id": record.get("template_id"),
        },
    }


def preprocess_query_record(record: Dict[str, Any], record_idx: int) -> Dict[str, Any]:
    raw_inp = normalize_text(record["input"])
    raw_out = record["output"]

    intent = raw_out["intent"].strip()
    cat = raw_out.get("category")
    period = raw_out.get("period")
    operation = raw_out.get("operation")

    clean_out = {
        "intent": intent,
        "category": cat,
        "period": period,
        "operation": operation,
    }

    if "start_date" in raw_out:
        clean_out["start_date"] = raw_out["start_date"]
    if "end_date" in raw_out:
        clean_out["end_date"] = raw_out["end_date"]

    user_prompt = raw_inp
    assistant_completion = json.dumps(clean_out, ensure_ascii=False)

    return {
        "id": f"slm_query_{record_idx:06d}",
        "task": "query_understanding",
        "template_id": record.get("template_id", "query_default"),
        "instruction": QUERY_UNDERSTANDING_SYSTEM_PROMPT,
        "input": user_prompt,
        "output": assistant_completion,
        "conversations": [
            {"role": "system", "content": QUERY_UNDERSTANDING_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": assistant_completion},
        ],
        "metadata": {
            "task": "query_understanding",
            "intent": intent,
            "category": cat,
            "period": period,
            "operation": operation,
            "template_id": record.get("template_id"),
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Preprocess raw synthetic dataset for SLM fine-tuning")
    parser.add_argument("--input", "-i", type=str, default="data/raw/synthetic_dataset.jsonl", help="Input raw JSONL file")
    parser.add_argument("--output", "-o", type=str, default="data/processed/processed_dataset.jsonl", help="Output processed JSONL file")
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if not in_path.exists():
        raise FileNotFoundError(f"Input file not found: {in_path.resolve()}")

    print(f"[Preprocessor] Reading raw records from {in_path}...")
    processed_records: List[Dict[str, Any]] = []
    seen_prompts = set()
    dup_count = 0

    with open(in_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, start=1):
            line_str = line.strip()
            if not line_str:
                continue
            raw_item = json.loads(line_str)
            task = raw_item.get("task")

            if task == "categorization":
                item = preprocess_categorization_record(raw_item, idx)
            elif task == "query_understanding":
                item = preprocess_query_record(raw_item, idx)
            else:
                continue

            # Deduplication key based on normalized input
            dedup_key = f"{item['task']}::{item['input'].strip().lower()}"
            if dedup_key in seen_prompts:
                dup_count += 1
                continue
            seen_prompts.add(dedup_key)
            processed_records.append(item)

    print(f"[Preprocessor] Processed {len(processed_records)} unique records (filtered {dup_count} duplicate inputs).")

    with open(out_path, "w", encoding="utf-8") as f:
        for record in processed_records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"[Preprocessor] Saved processed dataset to: {out_path.resolve()}")


if __name__ == "__main__":
    main()

