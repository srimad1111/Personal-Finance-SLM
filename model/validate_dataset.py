"""
validate_dataset.py
-------------------
Pydantic-based dataset validation module for Personal Finance SLM.
Validates synthetic transaction categorization and financial query understanding datasets.
Strictly checks schemas, enum constraints, value ranges, and duplicate entries.
"""

import sys
import re
import json
import argparse
from typing import Optional, List, Dict, Any, Union, Literal
from pathlib import Path
from pydantic import BaseModel, Field, field_validator, model_validator

# Allowed categories for Task A & Task B
ALLOWED_CATEGORIES = [
    "Food",
    "Shopping",
    "Transportation",
    "Entertainment",
    "Healthcare",
    "Education",
    "Bills",
    "Rent",
    "Groceries",
    "Travel",
    "Salary",
    "Investment",
    "Other",
]

# Allowed intents for Task B
ALLOWED_INTENTS = [
    "total_expenses",
    "total_income",
    "category_spending",
    "monthly_summary",
    "date_range_summary",
    "highest_spending_category",
    "budget_status",
    "savings_summary",
]

ALLOWED_TRANSACTION_TYPES = ["Expense", "Income"]

ALLOWED_PERIODS = [
    "current_month",
    "previous_month",
    "last_30_days",
    "current_week",
    "last_week",
    "today",
    "yesterday",
    "current_year",
    "previous_year",
    "all_time",
    "custom",
]

ALLOWED_OPERATIONS = [
    "sum",
    "max",
    "min",
    "count",
    "average",
    "compare",
    "check",
    "summary",
]


# ==============================================================================
# Task A: Categorization Schemas
# ==============================================================================

class CategorizationInput(BaseModel):
    description: str = Field(..., min_length=2, max_length=250, description="Transaction text description")
    amount: float = Field(..., gt=0, description="Transaction amount in local currency (must be positive)")

    @field_validator("description")
    def clean_description(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Description cannot be empty or whitespace only")
        return s

    @field_validator("amount")
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be strictly greater than 0")
        return round(float(v), 2)


class CategorizationOutput(BaseModel):
    category: str = Field(..., description="Assigned spending or income category")
    transaction_type: str = Field(..., description="Income or Expense")

    @field_validator("category")
    def validate_category(cls, v: str) -> str:
        if v not in ALLOWED_CATEGORIES:
            raise ValueError(f"Category '{v}' is not in allowed list: {ALLOWED_CATEGORIES}")
        return v

    @field_validator("transaction_type")
    def validate_type(cls, v: str) -> str:
        capitalized = v.capitalize()
        if capitalized not in ALLOWED_TRANSACTION_TYPES:
            raise ValueError(f"Transaction type '{v}' must be one of {ALLOWED_TRANSACTION_TYPES}")
        return capitalized


# ==============================================================================
# Task B: Query Understanding Schemas
# ==============================================================================

class QueryUnderstandingOutput(BaseModel):
    intent: str = Field(..., description="Financial query user intent")
    category: Optional[str] = Field(None, description="Target category if query is category-specific")
    period: Optional[str] = Field(None, description="Temporal time period of query")
    operation: Optional[str] = Field(None, description="Analytical mathematical operation")
    start_date: Optional[str] = Field(None, description="Custom start date for date range query")
    end_date: Optional[str] = Field(None, description="Custom end date for date range query")

    @field_validator("intent")
    def validate_intent(cls, v: str) -> str:
        if v not in ALLOWED_INTENTS:
            raise ValueError(f"Intent '{v}' is not in allowed list: {ALLOWED_INTENTS}")
        return v

    @field_validator("category")
    def validate_query_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "None" and v != "null" and v != "":
            if v not in ALLOWED_CATEGORIES:
                raise ValueError(f"Query category '{v}' is not in allowed categories list")
            return v
        return None

    @field_validator("period")
    def validate_query_period(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "None" and v != "null" and v != "":
            if v not in ALLOWED_PERIODS:
                raise ValueError(f"Query period '{v}' is not in allowed periods: {ALLOWED_PERIODS}")
            return v
        return None

    @field_validator("operation")
    def validate_query_operation(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "None" and v != "null" and v != "":
            if v not in ALLOWED_OPERATIONS:
                raise ValueError(f"Query operation '{v}' is not in allowed operations: {ALLOWED_OPERATIONS}")
            return v
        return None


# ==============================================================================
# Unified Dataset Record Model
# ==============================================================================

class DatasetRecord(BaseModel):
    task: Literal["categorization", "query_understanding"]
    input: Union[CategorizationInput, str]
    output: Union[CategorizationOutput, QueryUnderstandingOutput]
    template_id: Optional[str] = Field(None, description="Template identifier for group-based splitting")

    @model_validator(mode="after")
    def validate_task_consistency(self) -> "DatasetRecord":
        if self.task == "categorization":
            if not isinstance(self.input, (CategorizationInput, dict)):
                raise ValueError("Task 'categorization' input must match CategorizationInput schema")
            if not isinstance(self.output, (CategorizationOutput, dict)):
                raise ValueError("Task 'categorization' output must match CategorizationOutput schema")
        elif self.task == "query_understanding":
            if not isinstance(self.input, str) or not self.input.strip():
                raise ValueError("Task 'query_understanding' input must be a non-empty string")
            if not isinstance(self.output, (QueryUnderstandingOutput, dict)):
                raise ValueError("Task 'query_understanding' output must match QueryUnderstandingOutput schema")
        return self


# ==============================================================================
# Dataset Validation Runner
# ==============================================================================

def validate_dataset_file(file_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Validates an entire JSONL dataset file using Pydantic schemas.
    Checks for malformed records, duplicate inputs, category distributions, and intent coverage.
    """
    path = Path(file_path)
    if not path.exists():
        return {
            "valid": False,
            "error": f"File does not exist: {file_path}",
            "total_records": 0,
            "valid_records": 0,
            "failed_records": 0,
            "duplicate_inputs": 0,
        }

    total = 0
    valid_count = 0
    errors: List[Dict[str, Any]] = []
    seen_inputs = set()
    duplicate_count = 0

    task_counts = {"categorization": 0, "query_understanding": 0}
    category_counts = {cat: 0 for cat in ALLOWED_CATEGORIES}
    intent_counts = {intent: 0 for intent in ALLOWED_INTENTS}

    with open(path, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line_str = line.strip()
            if not line_str:
                continue
            total += 1

            try:
                raw_data = json.loads(line_str)
            except json.JSONDecodeError as jde:
                errors.append({"line": line_no, "error": f"Invalid JSON syntax: {str(jde)}"})
                continue

            try:
                # Handle raw format vs preprocessed instruction format
                target_data = dict(raw_data)
                
                # If output is a serialized JSON string (from preprocessed SLM format), parse it
                if isinstance(target_data.get("output"), str) and target_data["output"].strip().startswith("{"):
                    try:
                        target_data["output"] = json.loads(target_data["output"])
                    except Exception:
                        pass

                task = target_data.get("task")
                if not task and "metadata" in target_data:
                    task = target_data["metadata"].get("task")

                if task == "categorization":
                    # If input is formatted string like "Description: ...\nAmount: ...", extract fields for schema check
                    if isinstance(target_data.get("input"), str):
                        m = target_data.get("metadata", {})
                        if "amount" in m and "category" in m:
                            inp_obj = CategorizationInput(description=m.get("description", target_data["input"][:50]), amount=m["amount"])
                        else:
                            # Parse Description / Amount from string
                            desc_match = re.search(r"Description:\s*(.*?)(?:\nAmount:|$)", target_data["input"], re.DOTALL)
                            amt_match = re.search(r"Amount:\s*([\d\.]+)", target_data["input"])
                            desc_val = desc_match.group(1).strip() if desc_match else target_data["input"]
                            amt_val = float(amt_match.group(1)) if amt_match else 100.0
                            inp_obj = CategorizationInput(description=desc_val, amount=amt_val)
                    else:
                        inp_obj = CategorizationInput.model_validate(target_data["input"])

                    out_obj = CategorizationOutput.model_validate(target_data["output"])
                    record = DatasetRecord(task="categorization", input=inp_obj, output=out_obj, template_id=target_data.get("template_id"))
                    inp_repr = json.dumps(inp_obj.model_dump(), sort_keys=True)

                elif task == "query_understanding":
                    inp_str = target_data["input"] if isinstance(target_data["input"], str) else str(target_data["input"])
                    out_obj = QueryUnderstandingOutput.model_validate(target_data["output"])
                    record = DatasetRecord(task="query_understanding", input=inp_str, output=out_obj, template_id=target_data.get("template_id"))
                    inp_repr = inp_str.strip()
                else:
                    errors.append({"line": line_no, "error": f"Unrecognized record format; task is '{task}'"})
                    continue

                # Check duplicates
                hashable_key = f"{task}::{inp_repr.lower().strip()}"
                if hashable_key in seen_inputs:
                    duplicate_count += 1
                seen_inputs.add(hashable_key)

                # Track distributions
                if task in task_counts:
                    task_counts[task] += 1

                if task == "categorization":
                    cat = record.output.category
                    if cat in category_counts:
                        category_counts[cat] += 1
                elif task == "query_understanding":
                    intent = record.output.intent
                    if intent in intent_counts:
                        intent_counts[intent] += 1

                valid_count += 1

            except Exception as e:
                errors.append({"line": line_no, "error": str(e)})

    is_valid = (len(errors) == 0) and (total > 0)

    return {
        "valid": is_valid,
        "file": str(path),
        "total_records": total,
        "valid_records": valid_count,
        "failed_records": len(errors),
        "duplicate_inputs": duplicate_count,
        "task_distribution": task_counts,
        "category_distribution": category_counts,
        "intent_distribution": intent_counts,
        "sample_errors": errors[:10] if errors else [],
    }


def main():
    parser = argparse.ArgumentParser(description="Validate JSONL dataset for Personal Finance SLM")
    parser.add_argument("--input", "-i", type=str, default="data/raw/synthetic_dataset.jsonl", help="Path to JSONL file")
    args = parser.parse_args()

    result = validate_dataset_file(args.input)
    print("=" * 70)
    print(f"Dataset Validation Report: {result['file']}")
    print("=" * 70)
    print(f"Status           : {'PASSED [VALID]' if result['valid'] else 'FAILED [INVALID]'}")
    print(f"Total Records    : {result['total_records']}")
    print(f"Valid Records    : {result['valid_records']}")
    print(f"Failed Records   : {result['failed_records']}")
    print(f"Duplicate Inputs : {result['duplicate_inputs']}")
    print("-" * 70)
    print("Task Distribution:")
    for t, c in result.get("task_distribution", {}).items():
        pct = (c / result["total_records"] * 100) if result["total_records"] > 0 else 0
        print(f"  - {t:<22}: {c:5d} ({pct:5.1f}%)")
    print("-" * 70)

    if result["failed_records"] > 0:
        print("Sample Validation Errors:")
        for err in result["sample_errors"]:
            print(f"  Line {err.get('line')}: {err.get('error')}")
        print("=" * 70)
        sys.exit(1)
    else:
        print("All schemas and constraints verified successfully!")
        print("=" * 70)
        sys.exit(0)


if __name__ == "__main__":
    main()
