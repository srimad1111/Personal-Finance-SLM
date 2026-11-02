"""
dataset_loader.py
-----------------
Data loading and batch collation module for Personal Finance SLM fine-tuning.
Loads train/val/test splits, tokenizes records with prompt-masking, and dynamically pads batches.
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional
import torch
from torch.utils.data import Dataset
from formatting import tokenize_and_mask_instruction


class FinanceInstructionDataset(Dataset):
    """
    PyTorch Dataset for personal finance transaction categorization and query understanding.
    """
    def __init__(
        self,
        file_path: str,
        tokenizer: Any,
        max_seq_length: int = 512,
        max_samples: Optional[int] = None,
    ):
        self.tokenizer = tokenizer
        self.max_seq_length = max_seq_length
        self.records: List[Dict[str, Any]] = []

        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Dataset split file not found: {path.resolve()}")

        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if line_str:
                    self.records.append(json.loads(line_str))
                    if max_samples and len(self.records) >= max_samples:
                        break

        print(f"[DatasetLoader] Loaded {len(self.records)} records from {path.name}")

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        item = self.records[idx]
        tokenized = tokenize_and_mask_instruction(
            record=item,
            tokenizer=self.tokenizer,
            max_seq_length=self.max_seq_length,
        )
        return tokenized


class FinanceDataCollator:
    """
    Dynamically pads input_ids, attention_mask, and labels to the maximum length in a batch.
    Uses -100 as label padding to avoid computing loss on pad tokens.
    """
    def __init__(self, tokenizer: Any, pad_to_multiple_of: Optional[int] = 8):
        self.tokenizer = tokenizer
        self.pad_to_multiple_of = pad_to_multiple_of
        self.pad_token_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else 0

    def __call__(self, batch: List[Dict[str, List[int]]]) -> Dict[str, torch.Tensor]:
        max_len = max(len(item["input_ids"]) for item in batch)

        if self.pad_to_multiple_of and (max_len % self.pad_to_multiple_of != 0):
            max_len = ((max_len // self.pad_to_multiple_of) + 1) * self.pad_to_multiple_of

        padded_input_ids = []
        padded_attention_mask = []
        padded_labels = []

        for item in batch:
            input_ids = item["input_ids"]
            attention_mask = item["attention_mask"]
            labels = item["labels"]

            pad_len = max_len - len(input_ids)

            padded_input_ids.append(input_ids + [self.pad_token_id] * pad_len)
            padded_attention_mask.append(attention_mask + [0] * pad_len)
            padded_labels.append(labels + [-100] * pad_len)

        return {
            "input_ids": torch.tensor(padded_input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(padded_attention_mask, dtype=torch.long),
            "labels": torch.tensor(padded_labels, dtype=torch.long),
        }

