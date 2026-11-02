"""
formatting.py
-------------
Prompt formatting and label-masking utilities for SLM instruction fine-tuning.
Supports Gemma, Llama, and Qwen chat templates.
Applies prompt masking (labels = -100) so cross-entropy loss is computed ONLY
on the assistant JSON completion, not the user instruction.
"""

import json
from typing import Dict, Any, List, Optional, Tuple
import torch

GEMMA_CHAT_TEMPLATE = (
    "{{ bos_token }}"
    "{% for message in messages %}"
    "{% if message['role'] == 'system' %}"
    "{{ '<start_of_turn>user\n' + message['content'] + '\n\n' }}"
    "{% elif message['role'] == 'user' %}"
    "{% if loop.previtem and loop.previtem['role'] == 'system' %}"
    "{{ message['content'] + '<end_of_turn>\n' }}"
    "{% else %}"
    "{{ '<start_of_turn>user\n' + message['content'] + '<end_of_turn>\n' }}"
    "{% endif %}"
    "{% elif message['role'] == 'assistant' %}"
    "{{ '<start_of_turn>model\n' + message['content'] + '<end_of_turn>\n' }}"
    "{% endif %}"
    "{% endfor %}"
    "{% if add_generation_prompt %}"
    "{{ '<start_of_turn>model\n' }}"
    "{% endif %}"
)


def format_chat_prompt(
    conversations: List[Dict[str, str]],
    tokenizer: Any,
    add_generation_prompt: bool = False
) -> str:
    """
    Formats multi-turn messages using tokenizer's chat template or Gemma fallback.
    """
    try:
        if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template:
            return tokenizer.apply_chat_template(
                conversations,
                tokenize=False,
                add_generation_prompt=add_generation_prompt,
            )
    except Exception:
        pass

    # High-fidelity fallback for Gemma / ChatML format
    formatted = ""
    for msg in conversations:
        role = msg.get("role", "user")
        content = msg.get("content", "").strip()
        if role == "system":
            formatted += f"<start_of_turn>system\n{content}<end_of_turn>\n"
        elif role == "user":
            formatted += f"<start_of_turn>user\n{content}<end_of_turn>\n"
        elif role == "assistant":
            formatted += f"<start_of_turn>model\n{content}<end_of_turn>\n"

    if add_generation_prompt:
        formatted += "<start_of_turn>model\n"

    return formatted


def tokenize_and_mask_instruction(
    record: Dict[str, Any],
    tokenizer: Any,
    max_seq_length: int = 512,
) -> Dict[str, torch.Tensor]:
    """
    Tokenizes a training example and creates an attention mask and label tensor.
    Tokens belonging to the prompt/instruction are masked with -100 (PyTorch cross-entropy ignore index).
    Loss is calculated exclusively on assistant output tokens.
    """
    conversations = record.get("conversations", [])

    if not conversations:
        # Construct from instruction, input, output
        conversations = [
            {"role": "system", "content": record.get("instruction", "")},
            {"role": "user", "content": record.get("input", "")},
            {"role": "assistant", "content": record.get("output", "")},
        ]

    # Split prompt (system + user) vs completion (assistant)
    prompt_msgs = [m for m in conversations if m.get("role") != "assistant"]
    completion_msgs = [m for m in conversations if m.get("role") == "assistant"]

    prompt_text = format_chat_prompt(prompt_msgs, tokenizer, add_generation_prompt=True)
    full_text = format_chat_prompt(conversations, tokenizer, add_generation_prompt=False)

    # Tokenize full sequence and prompt sequence
    full_tokens = tokenizer(
        full_text,
        max_length=max_seq_length,
        truncation=True,
        padding=False,
        return_tensors=None,
    )

    prompt_tokens = tokenizer(
        prompt_text,
        max_length=max_seq_length,
        truncation=True,
        padding=False,
        return_tensors=None,
    )

    input_ids = full_tokens["input_ids"]
    attention_mask = full_tokens["attention_mask"]

    # Label masking: set -100 for all prompt token positions
    prompt_len = min(len(prompt_tokens["input_ids"]), len(input_ids))
    labels = [-100] * prompt_len + input_ids[prompt_len:]

    assert len(input_ids) == len(labels), "Input IDs and Labels length mismatch"

    return {
        "input_ids": input_ids,
        "attention_mask": attention_mask,
        "labels": labels,
    }

