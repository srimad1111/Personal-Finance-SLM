"""
train.py
--------
Main fine-tuning script for SLM-Powered Personal Finance Assistant.
Jointly trains on transaction categorization and financial query understanding.

Key Capabilities:
  - LoRA and QLoRA (4-bit NF4) parameter-efficient fine-tuning via PEFT.
  - Automatic GPU detection and precision selection (bf16 for Ampere/A100, fp16 for T4, fp32 for CPU).
  - Gradient accumulation and gradient checkpointing for memory efficiency.
  - Checkpoint saving, evaluation tracking, and training resumption support.
  - Separate LoRA adapter saving.
  - Smoke-test mode (--smoke-test) for quick local verification before full cloud training.
"""

import os
import sys
import json
import yaml
import argparse
from pathlib import Path
from typing import Dict, Any, Optional

import torch
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    TrainerCallback,
)

# Optional PEFT import with graceful fallback
try:
    from peft import (
        LoraConfig,
        get_peft_model,
        prepare_model_for_kbit_training,
        TaskType,
    )
    PEFT_AVAILABLE = True
except ImportError:
    PEFT_AVAILABLE = False

# Optional BitsAndBytes import
try:
    from transformers import BitsAndBytesConfig
    BNB_AVAILABLE = True
except ImportError:
    BNB_AVAILABLE = False

from dataset_loader import FinanceInstructionDataset, FinanceDataCollator


# ==============================================================================
# Hardware & Precision Auto-Detection
# ==============================================================================

def detect_device_and_precision() -> Dict[str, Any]:
    """
    Detects compute device, GPU compute capability, and selects optimal dtype.
    """
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        capability = torch.cuda.get_device_capability(0)
        major, minor = capability

        # Ampere (RTX 30xx, A100) or newer supports native bfloat16
        if major >= 8:
            dtype = torch.bfloat16
            bf16 = True
            fp16 = False
            device_desc = f"{gpu_name} (Compute {major}.{minor}) -> bf16 supported"
        else:
            # Turing (T4, GTX 16xx, RTX 20xx) uses fp16
            dtype = torch.float16
            bf16 = False
            fp16 = True
            device_desc = f"{gpu_name} (Compute {major}.{minor}) -> fp16 (T4 / Turing)"

        return {
            "device": "cuda",
            "device_desc": device_desc,
            "dtype": dtype,
            "bf16": bf16,
            "fp16": fp16,
            "gpu_count": torch.cuda.device_count(),
        }
    else:
        return {
            "device": "cpu",
            "device_desc": "CPU (No CUDA detected)",
            "dtype": torch.float32,
            "bf16": False,
            "fp16": False,
            "gpu_count": 0,
        }


# ==============================================================================
# Model & Quantization Loader
# ==============================================================================

def load_model_and_tokenizer(
    model_cfg: Dict[str, Any],
    lora_cfg: Dict[str, Any],
    quant_cfg: Dict[str, Any],
    hw_info: Dict[str, Any],
    use_qlora: bool = True,
):
    """
    Initializes tokenizer, base causal LM, applies 4-bit QLoRA if supported,
    and wraps with PEFT LoRA adapter.
    """
    model_id = model_cfg.get("name_or_path", "google/gemma-3-1b-it")
    print(f"[Model] Loading tokenizer for {model_id}...")

    tokenizer = AutoTokenizer.from_pretrained(
        model_id,
        trust_remote_code=model_cfg.get("trust_remote_code", True),
        use_fast=model_cfg.get("use_fast_tokenizer", True),
    )

    # Ensure padding token is set
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # Quantization setup
    bnb_config = None
    if use_qlora and hw_info["device"] == "cuda" and BNB_AVAILABLE:
        compute_dtype = hw_info["dtype"]
        print(f"[Model] Configuring 4-bit QLoRA with compute dtype: {compute_dtype}")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type=quant_cfg.get("bnb_4bit_quant_type", "nf4"),
            bnb_4bit_use_double_quant=quant_cfg.get("bnb_4bit_use_double_quant", True),
            bnb_4bit_compute_dtype=compute_dtype,
        )
    else:
        if use_qlora and hw_info["device"] != "cuda":
            print("[Model] QLoRA requested but running on CPU; falling back to unquantized float32.")

    print(f"[Model] Loading base model: {model_id}...")
    model_kwargs: Dict[str, Any] = {
        "trust_remote_code": model_cfg.get("trust_remote_code", True),
        "torch_dtype": hw_info["dtype"],
    }

    if bnb_config is not None:
        model_kwargs["quantization_config"] = bnb_config
        model_kwargs["device_map"] = "auto"
    elif hw_info["device"] == "cuda":
        model_kwargs["device_map"] = "auto"

    try:
        model = AutoModelForCausalLM.from_pretrained(model_id, **model_kwargs)
    except Exception as e:
        fallback = model_cfg.get("fallback_model")
        if fallback and fallback != model_id:
            print(f"[Model Warning] Could not load {model_id}: {e}")
            print(f"[Model] Attempting fallback to {fallback}...")
            model = AutoModelForCausalLM.from_pretrained(fallback, **model_kwargs)
        else:
            raise e

    # Prepare model for PEFT LoRA
    if not PEFT_AVAILABLE:
        raise ImportError(
            "The 'peft' package is required for LoRA fine-tuning. "
            "Please install it using: pip install peft"
        )

    if bnb_config is not None:
        model = prepare_model_for_kbit_training(
            model,
            use_gradient_checkpointing=True
        )

    target_modules = lora_cfg.get("target_modules", [
        "q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"
    ])

    peft_config = LoraConfig(
        r=lora_cfg.get("r", 16),
        lora_alpha=lora_cfg.get("lora_alpha", 32),
        lora_dropout=lora_cfg.get("lora_dropout", 0.05),
        bias=lora_cfg.get("bias", "none"),
        task_type=TaskType.CAUSAL_LM,
        target_modules=target_modules,
    )

    print(f"[LoRA] Applying LoRA adapter (r={peft_config.r}, alpha={peft_config.lora_alpha})...")
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    return model, tokenizer


# ==============================================================================
# Training Pipeline
# ==============================================================================

def train_pipeline(
    config_path: str = "model/training/config.yaml",
    smoke_test: bool = False,
    resume_from_checkpoint: Optional[str] = None,
    no_qlora: bool = False,
    epochs: Optional[int] = None,
    batch_size: Optional[int] = None,
    learning_rate: Optional[float] = None,
):
    # 1. Load Configuration
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    model_cfg = config.get("model", {})
    lora_cfg = config.get("lora", {})
    quant_cfg = config.get("quantization", {})
    train_cfg = config.get("training", {})
    data_cfg = config.get("data", {})
    smoke_cfg = config.get("smoke_test", {})

    # CLI Overrides
    if epochs is not None:
        train_cfg["num_train_epochs"] = epochs
    if batch_size is not None:
        train_cfg["per_device_train_batch_size"] = batch_size
        train_cfg["per_device_eval_batch_size"] = batch_size
    if learning_rate is not None:
        train_cfg["learning_rate"] = learning_rate

    use_qlora = quant_cfg.get("use_qlora", True) and (not no_qlora)

    print("=" * 70)
    print("SLM FINE-TUNING PIPELINE: PERSONAL FINANCE ASSISTANT")
    print("=" * 70)
    hw_info = detect_device_and_precision()
    print(f"[Hardware] Detected: {hw_info['device_desc']}")
    print(f"[Mode]     Smoke-Test: {smoke_test} | QLoRA 4-Bit: {use_qlora}")
    print("=" * 70)

    # 2. Load Model and Tokenizer
    model, tokenizer = load_model_and_tokenizer(
        model_cfg=model_cfg,
        lora_cfg=lora_cfg,
        quant_cfg=quant_cfg,
        hw_info=hw_info,
        use_qlora=use_qlora,
    )

    # 3. Load Datasets
    max_train = smoke_cfg.get("max_train_samples", 32) if smoke_test else None
    max_eval = smoke_cfg.get("max_eval_samples", 16) if smoke_test else None

    train_path = data_cfg.get("train_path", "model/data/splits/train.jsonl")
    val_path = data_cfg.get("val_path", "model/data/splits/val.jsonl")

    train_dataset = FinanceInstructionDataset(
        file_path=train_path,
        tokenizer=tokenizer,
        max_seq_length=data_cfg.get("max_seq_length", 512),
        max_samples=max_train,
    )

    eval_dataset = FinanceInstructionDataset(
        file_path=val_path,
        tokenizer=tokenizer,
        max_seq_length=data_cfg.get("max_seq_length", 512),
        max_samples=max_eval,
    )

    data_collator = FinanceDataCollator(tokenizer=tokenizer)

    # 4. Configure Training Arguments
    out_dir = Path(train_cfg.get("output_dir", "model/training/outputs"))
    out_dir.mkdir(parents=True, exist_ok=True)
    adapter_dir = Path(train_cfg.get("adapter_dir", "model/training/outputs/final_adapter"))
    adapter_dir.mkdir(parents=True, exist_ok=True)

    max_steps = smoke_cfg.get("max_steps", 5) if smoke_test else -1
    num_epochs = 1 if smoke_test else train_cfg.get("num_train_epochs", 3)

    training_args = TrainingArguments(
        output_dir=str(out_dir),
        num_train_epochs=num_epochs,
        max_steps=max_steps,
        per_device_train_batch_size=train_cfg.get("per_device_train_batch_size", 4),
        per_device_eval_batch_size=train_cfg.get("per_device_eval_batch_size", 4),
        gradient_accumulation_steps=train_cfg.get("gradient_accumulation_steps", 4),
        gradient_checkpointing=train_cfg.get("gradient_checkpointing", True),
        learning_rate=float(train_cfg.get("learning_rate", 2e-4)),
        lr_scheduler_type=train_cfg.get("lr_scheduler_type", "cosine"),
        warmup_ratio=float(train_cfg.get("warmup_ratio", 0.05)),
        weight_decay=float(train_cfg.get("weight_decay", 0.01)),
        max_grad_norm=float(train_cfg.get("max_grad_norm", 1.0)),
        logging_steps=train_cfg.get("logging_steps", 10),
        eval_strategy=train_cfg.get("eval_strategy", "steps"),
        eval_steps=10 if smoke_test else train_cfg.get("eval_steps", 50),
        save_strategy=train_cfg.get("save_strategy", "steps"),
        save_steps=10 if smoke_test else train_cfg.get("save_steps", 50),
        save_total_limit=train_cfg.get("save_total_limit", 3),
        load_best_model_at_end=not smoke_test,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        fp16=hw_info["fp16"],
        bf16=hw_info["bf16"],
        dataloader_num_workers=0 if os.name == "nt" else train_cfg.get("dataloader_num_workers", 2),
        report_to="none" if smoke_test else train_cfg.get("report_to", "tensorboard"),
    )

    # 5. Initialize Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
    )

    # 6. Execute Training
    print("[Trainer] Initiating training run...")
    resume_arg = resume_from_checkpoint if resume_from_checkpoint else None
    train_result = trainer.train(resume_from_checkpoint=resume_arg)

    print(f"[Trainer] Training completed successfully. Train Loss: {train_result.training_loss:.4f}")

    # 7. Save Final LoRA Adapter and Tokenizer
    print(f"[Adapter] Saving fine-tuned LoRA adapter to {adapter_dir.resolve()}...")
    model.save_pretrained(str(adapter_dir))
    tokenizer.save_pretrained(str(adapter_dir))

    # Save training metrics and active configurations
    metrics_file = adapter_dir / "training_metrics.json"
    with open(metrics_file, "w", encoding="utf-8") as f:
        json.dump(train_result.metrics, f, indent=2)

    active_cfg_file = adapter_dir / "training_config.yaml"
    with open(active_cfg_file, "w", encoding="utf-8") as f:
        yaml.dump(config, f, default_flow_style=False)

    print(f"[Adapter] Adapter weights, tokenizer, and metrics preserved at: {adapter_dir}")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Fine-tune Small Language Model for Personal Finance")
    parser.add_argument("--config", "-c", type=str, default="model/training/config.yaml", help="Path to config.yaml")
    parser.add_argument("--smoke-test", action="store_true", help="Run quick 5-step smoke test to verify execution")
    parser.add_argument("--resume-from-checkpoint", type=str, default=None, help="Path to checkpoint folder to resume")
    parser.add_argument("--no-qlora", action="store_true", help="Disable 4-bit QLoRA and train with unquantized weights")
    parser.add_argument("--epochs", type=int, default=None, help="Override number of training epochs")
    parser.add_argument("--batch-size", type=int, default=None, help="Override per-device batch size")
    parser.add_argument("--lr", type=float, default=None, help="Override learning rate")
    args = parser.parse_args()

    train_pipeline(
        config_path=args.config,
        smoke_test=args.smoke_test,
        resume_from_checkpoint=args.resume_from_checkpoint,
        no_qlora=args.no_qlora,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
    )


if __name__ == "__main__":
    main()

