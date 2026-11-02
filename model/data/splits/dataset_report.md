# Personal Finance SLM: Dataset Statistics Report

**Generated Automatically for Phase 4: Dataset Preparation**

---

## 1. Executive Summary

| Metric | Training Set | Validation Set | Test Set | Total |
| :--- | :---: | :---: | :---: | :---: |
| **Count** | 6508 | 743 | 743 | **7994** |
| **Ratio** | 81.41% | 9.29% | 9.29% | **100%** |
| **Vocabulary Size** | 6029 words | 1739 words | 1725 words | — |
| **Data Leakage Overlap** | — | 0 | **0 (0.0%)** | **Verified Leak-Free** |

---

## 2. Task Distribution

- **Financial Transaction Categorization**: 4394 examples (55.0%)
- **Financial Query Understanding**: 3600 examples (45.0%)

---

## 3. Transaction Categorization Distribution (Across 13 Categories)

| Category | Total Examples | Share (%) | Median Amount (INR) | Mean Amount (INR) |
| :--- | :---: | :---: | :---: | :---: |
| **Bills** | 399 | 5.0% | ₹4564.95 | ₹4396.88 |
| **Education** | 401 | 5.0% | ₹22563.55 | ₹23499.54 |
| **Entertainment** | 406 | 5.1% | ₹2897.21 | ₹2880.78 |
| **Food** | 415 | 5.2% | ₹1677.04 | ₹1693.39 |
| **Groceries** | 412 | 5.2% | ₹3702.71 | ₹3519.31 |
| **Healthcare** | 407 | 5.1% | ₹4418.15 | ₹4541.66 |
| **Investment** | 392 | 4.9% | ₹63675.49 | ₹62692.41 |
| **Other** | 411 | 5.1% | ₹17590.98 | ₹17893.17 |
| **Rent** | 402 | 5.0% | ₹43812.11 | ₹42136.99 |
| **Salary** | 420 | 5.3% | ₹202565.74 | ₹202638.25 |
| **Shopping** | 402 | 5.0% | ₹8883.84 | ₹9216.95 |
| **Transportation** | 410 | 5.1% | ₹2294.69 | ₹2346.28 |
| **Travel** | 417 | 5.2% | ₹22798.82 | ₹25282.52 |

---

## 4. Query Understanding Intent Distribution (Across 8 Intents)

| Intent | Total Queries | Share (%) |
| :--- | :---: | :---: |
| `budget_status` | 450 | 5.6% |
| `category_spending` | 450 | 5.6% |
| `date_range_summary` | 450 | 5.6% |
| `highest_spending_category` | 450 | 5.6% |
| `monthly_summary` | 450 | 5.6% |
| `savings_summary` | 450 | 5.6% |
| `total_expenses` | 450 | 5.6% |
| `total_income` | 450 | 5.6% |

---

## 5. Sequence Length & Complexity

| Split | Avg Input Words | Max Input Words | Avg Output Words | Max Output Words |
| :--- | :---: | :---: | :---: | :---: |
| **Train** | 12.53 | 21 | 7.66 | 15 |
| **Val** | 12.48 | 20 | 7.67 | 15 |
| **Test** | 12.6 | 21 | 7.67 | 15 |

---

## 6. Leakage & Integrity Invariants

1. **Deterministic Reproducibility**: Generated using fixed seed `42`.
2. **Strict Schema Conformance**: 100% of records validated via Pydantic (`validate_dataset.py`).
3. **No Overlap**: Train and Test sets have strictly **0 overlapping queries** (`train_test_overlap = 0`).
4. **Group-Aware Splitting**: Template groups (`template_id`) allocated systematically to evaluate out-of-distribution phrasing.
