# Methodology: On-Device Small Language Model (SLM) for Personal Finance

## 1. Research Objectives
1. Adapt a Small Language Model (sub-3B parameters) to excel at:
   - High-accuracy transaction categorization (e.g., matching raw text like `"WAL-MART #2193 DALLAS TX"` to `groceries` / `shopping`).
   - Domain-specific financial Q&A and budgeting analysis grounded in user's SQLite records.
2. Maximize inference throughput on edge mobile devices while minimizing RAM consumption and battery drain.

---

## 2. Dataset Strategy

### 2.1 Categorization Instruction Dataset
- Synthetic and curated bank statement narratives with realistic noise, merchant codes, and abbreviations.
- Strict taxonomy: `salary`, `investment`, `food_and_dining`, `groceries`, `shopping`, `utilities`, `housing`, `transportation`, `healthcare`, `entertainment`, `education`, `misc`.

### 2.2 Financial Q&A & Reasoning Dataset
- Instruction-response pairs answering user queries using provided transaction context:
  - *"How much did I spend on dining out this month?"*
  - *"Can I afford a $200 gadget based on my savings this week?"*

---

## 3. Fine-Tuning Recipe

- **Approach**: Low-Rank Adaptation (LoRA) / QLoRA with 4-bit NormalFloat (NF4) base model weights.
- **Hyperparameters**:
  - LoRA Rank ($r$): 16 or 32
  - LoRA Alpha ($\alpha$): 32 or 64
  - Target Modules: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`
  - Optimizer: AdamW / PagedAdamW 8-bit
  - Context Length: 2048 tokens

---

## 4. Mobile Quantization & Deployment

1. **Weight Merging**: Merge LoRA adapter weights back into base 16-bit model weights.
2. **GGUF Conversion**: Convert safetensors to GGUF format using `llama.cpp` conversion scripts.
3. **Quantization**: Apply `Q4_K_M` or `Q4_0` quantization.
4. **Validation**: Benchmark Perplexity and categorization F1 score pre- and post-quantization to verify negligible degradation (< 1.5% drop in F1).
