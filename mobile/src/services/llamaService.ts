import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { initLlama, LlamaContext } from 'llama.rn';
import {
  getFinancialSummary,
  getCategoryWiseTotals,
  getMonthlyTrends,
  getBudgetProgress,
} from '../database';
import { formatINR } from '../utils/currency';
import { ChatMessage } from '../types';

export const MODEL_FILENAME = 'personal-finance-slm-Q4_K_M.gguf';
export const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
export const TARGET_MODEL_PATH = `${MODEL_DIR}${MODEL_FILENAME}`;

let activeContext: LlamaContext | null = null;
let isInitializing = false;

export interface ModelStatus {
  available: boolean;
  path: string;
  sizeBytes?: number;
  sizeFormatted?: string;
  isNativeSupported: boolean;
}

export interface ParsedQueryIntent {
  intent:
    | 'total_expenses'
    | 'total_income'
    | 'category_spending'
    | 'monthly_summary'
    | 'date_range_summary'
    | 'highest_spending_category'
    | 'budget_status'
    | 'savings_summary'
    | 'general_balance';
  category?: string;
  period?: string;
  operation?: string;
  confidence?: number;
}

/**
 * Format bytes to readable string (e.g. 776.5 MB)
 */
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Checks whether the Gemma 3 1B GGUF model is placed in application-private storage
 */
export async function checkModelStatus(): Promise<ModelStatus> {
  const isNativeSupported = Platform.OS === 'android' || Platform.OS === 'ios';

  try {
    const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
    }

    const fileInfo = await FileSystem.getInfoAsync(TARGET_MODEL_PATH);
    if (fileInfo.exists && !fileInfo.isDirectory) {
      return {
        available: true,
        path: TARGET_MODEL_PATH,
        sizeBytes: fileInfo.size,
        sizeFormatted: fileInfo.size ? formatFileSize(fileInfo.size) : undefined,
        isNativeSupported,
      };
    }
  } catch (err) {
    console.warn('[LLAMA_SERVICE] Error checking model status:', err);
  }

  return {
    available: false,
    path: TARGET_MODEL_PATH,
    isNativeSupported,
  };
}

/**
 * Safely streams and copies an imported GGUF file into application-private storage
 */
export async function importModelFromUri(
  sourceUri: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
    }

    if (onProgress) onProgress(0.1);

    // Copy file into target document sandbox
    await FileSystem.copyAsync({
      from: sourceUri,
      to: TARGET_MODEL_PATH,
    });

    if (onProgress) onProgress(1.0);

    const verified = await checkModelStatus();
    return verified.available;
  } catch (err) {
    console.error('[LLAMA_SERVICE] Model import error:', err);
    throw err;
  }
}

/**
 * Initialize on-device LlamaContext with Gemma 3 1B parameters
 */
export async function getOrInitLlamaContext(
  onProgress?: (progress: number) => void
): Promise<LlamaContext | null> {
  if (activeContext) {
    return activeContext;
  }

  if (isInitializing) {
    return null;
  }

  if (Platform.OS === 'web') {
    return null;
  }

  const status = await checkModelStatus();
  if (!status.available) {
    return null;
  }

  try {
    isInitializing = true;

    // Optimal on-device params for mobile 64-bit ARM CPU
    activeContext = await initLlama(
      {
        model: TARGET_MODEL_PATH,
        n_ctx: 2048,
        n_threads: 4,
        use_mmap: true,
        is_model_asset: false,
      },
      (p) => {
        if (onProgress) onProgress(p);
      }
    );

    return activeContext;
  } catch (err) {
    console.error('[LLAMA_SERVICE] Failed to initialize Llama context:', err);
    activeContext = null;
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Format prompt according to Gemma 3 1B instruction-tuning chat template
 */
export function formatGemmaPrompt(userQuestion: string): string {
  return `<start_of_turn>user\nTask: Financial Query Understanding\nQuestion: ${userQuestion.trim()}<end_of_turn>\n<start_of_turn>model\n`;
}

/**
 * Parse structured JSON output from model completion
 */
export function extractIntentJson(rawOutput: string): ParsedQueryIntent | null {
  try {
    // Locate JSON within model tokens
    const jsonMatch = rawOutput.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.intent) {
        return parsed as ParsedQueryIntent;
      }
    }
  } catch (e) {
    // Non-JSON or partial output
  }
  return null;
}

/**
 * Execute deterministic SQLite query given an understood financial intent
 */
export async function executeDeterministicFinancialQuery(
  intent: ParsedQueryIntent,
  rawQuestion: string
): Promise<{ text: string; insight?: ChatMessage['financialInsight'] }> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const monthStartDate = `${currentYear}-${currentMonthStr}-01`;

  switch (intent.intent) {
    case 'total_expenses': {
      const summary = await getFinancialSummary(monthStartDate);
      return {
        text: `Your total recorded expenses for the current month amount to ${formatINR(
          summary.totalExpenses
        )}, evaluated deterministically from ${summary.transactionCount} transactions in your local SQLite ledger.`,
        insight: {
          type: 'metric',
          title: 'Total Monthly Expenses',
          value: formatINR(summary.totalExpenses),
          details: `${summary.transactionCount} transactions recorded`,
        },
      };
    }

    case 'total_income': {
      const summary = await getFinancialSummary(monthStartDate);
      return {
        text: `Your total recorded income for the current month is ${formatINR(
          summary.totalIncome
        )}, stored safely in your offline SQLite database.`,
        insight: {
          type: 'metric',
          title: 'Total Monthly Income',
          value: formatINR(summary.totalIncome),
          details: 'Verified local inflows',
        },
      };
    }

    case 'category_spending': {
      const categoryTotals = await getCategoryWiseTotals('expense', monthStartDate);
      const catTarget = intent.category?.toLowerCase() || '';
      const matched = categoryTotals.find((c) =>
        c.categoryName.toLowerCase().includes(catTarget) ||
        c.categoryId.toLowerCase().includes(catTarget)
      );

      if (matched) {
        return {
          text: `You have spent ${formatINR(matched.totalAmount)} on ${matched.categoryName} this month (${matched.percentage.toFixed(
            1
          )}% of total outflows across ${matched.transactionCount} transactions).`,
          insight: {
            type: 'breakdown',
            title: `Category: ${matched.categoryName}`,
            value: formatINR(matched.totalAmount),
            details: `${matched.percentage.toFixed(1)}% of monthly spend`,
          },
        };
      } else {
        return {
          text: `No recorded expenses found for category "${intent.category || 'specified'}" this month in your SQLite ledger.`,
          insight: {
            type: 'metric',
            title: intent.category ? `Category: ${intent.category}` : 'Category Outflow',
            value: formatINR(0),
            details: '0 transactions found in period',
          },
        };
      }
    }

    case 'highest_spending_category': {
      const categoryTotals = await getCategoryWiseTotals('expense', monthStartDate);
      const topExpense = categoryTotals.length > 0 ? categoryTotals[0] : null;

      if (topExpense) {
        return {
          text: `Your highest spending category this month is ${topExpense.categoryName} with ${formatINR(
            topExpense.totalAmount
          )} (${topExpense.percentage.toFixed(1)}% of your expenses).`,
          insight: {
            type: 'breakdown',
            title: `Top Outflow: ${topExpense.categoryName}`,
            value: formatINR(topExpense.totalAmount),
            details: `${topExpense.percentage.toFixed(1)}% across ${topExpense.transactionCount} records`,
          },
        };
      }
      return {
        text: 'No expense records found in your SQLite ledger yet.',
      };
    }

    case 'monthly_summary':
    case 'savings_summary': {
      const summary = await getFinancialSummary(monthStartDate);
      const savings = summary.totalIncome - summary.totalExpenses;
      const rate = summary.totalIncome > 0 ? (savings / summary.totalIncome) * 100 : 0;

      return {
        text: `Deterministic Monthly Ledger Summary:\n\n• Inflow: ${formatINR(
          summary.totalIncome
        )}\n• Outflow: ${formatINR(summary.totalExpenses)}\n• Net Savings: ${formatINR(
          savings
        )} (${rate.toFixed(1)}% savings rate)\n\nCalculated offline across ${summary.transactionCount} verified SQLite entries.`,
        insight: {
          type: 'metric',
          title: 'Monthly Summary (SQLite)',
          value: `${formatINR(savings)} Net`,
          details: `Inflow: ${formatINR(summary.totalIncome)} | Outflow: ${formatINR(summary.totalExpenses)}`,
        },
      };
    }

    case 'budget_status': {
      const budgets = await getBudgetProgress(now.getMonth() + 1, currentYear);
      const totalLimit = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
      const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
      const remaining = Math.max(totalLimit - totalSpent, 0);

      return {
        text: `Budget Status for ${now.toLocaleString('default', { month: 'long' })}:\n\n• Monthly Limit: ${formatINR(
          totalLimit
        )}\n• Total Utilized: ${formatINR(totalSpent)}\n• Safe to Spend: ${formatINR(
          remaining
        )}\n\nMonitoring ${budgets.length} category budgets in your local database.`,
        insight: {
          type: 'metric',
          title: 'Budget Compliance',
          value: `${formatINR(remaining)} Available`,
          details: `${formatINR(totalSpent)} spent of ${formatINR(totalLimit)} limit`,
        },
      };
    }

    default: {
      const summary = await getFinancialSummary();
      return {
        text: `Your current net balance is ${formatINR(
          summary.netBalance
        )} with total lifetime income of ${formatINR(
          summary.totalIncome
        )} and expenses of ${formatINR(summary.totalExpenses)}.`,
        insight: {
          type: 'metric',
          title: 'Ledger State',
          value: formatINR(summary.netBalance),
          details: `${summary.transactionCount} total records evaluated`,
        },
      };
    }
  }
}

/**
 * High-level inference coordinator:
 * Runs Gemma 3 1B on-device when model is available, parses structured intent,
 * and retrieves exact mathematical totals from local SQLite.
 */
export async function runOfflineQueryInference(
  userQuery: string
): Promise<{ text: string; insight?: ChatMessage['financialInsight']; intentUsed?: string }> {
  // Check if native llama is available
  const context = await getOrInitLlamaContext();

  if (context) {
    try {
      const prompt = formatGemmaPrompt(userQuery);

      const completion = await context.completion({
        prompt,
        n_predict: 96,
        temperature: 0.1,
        stop: ['<end_of_turn>', '</s>'],
      });

      const parsedIntent = extractIntentJson(completion.text);
      if (parsedIntent && parsedIntent.intent) {
        const queryResult = await executeDeterministicFinancialQuery(parsedIntent, userQuery);
        return {
          ...queryResult,
          intentUsed: parsedIntent.intent,
        };
      }
    } catch (inferErr) {
      console.warn('[LLAMA_SERVICE] Native inference exception, falling back to deterministic router:', inferErr);
    }
  }

  // Deterministic local keyword intent router fallback
  const lower = userQuery.toLowerCase();
  let fallbackIntent: ParsedQueryIntent['intent'] = 'general_balance';
  let category: string | undefined = undefined;

  if (lower.includes('highest') || lower.includes('largest') || lower.includes('most spent')) {
    fallbackIntent = 'highest_spending_category';
  } else if (lower.includes('budget') || lower.includes('limit') || lower.includes('safe to spend')) {
    fallbackIntent = 'budget_status';
  } else if (lower.includes('summary') || lower.includes('savings') || lower.includes('save')) {
    fallbackIntent = 'monthly_summary';
  } else if (lower.includes('income') || lower.includes('salary') || lower.includes('earn')) {
    fallbackIntent = 'total_income';
  } else if (lower.includes('spend') || lower.includes('expense') || lower.includes('outflow')) {
    const categories = ['food', 'shopping', 'transport', 'groceries', 'entertainment', 'bills', 'rent'];
    for (const cat of categories) {
      if (lower.includes(cat)) {
        fallbackIntent = 'category_spending';
        category = cat;
        break;
      }
    }
    if (!category) {
      fallbackIntent = 'total_expenses';
    }
  }

  const result = await executeDeterministicFinancialQuery({ intent: fallbackIntent, category }, userQuery);
  return {
    ...result,
    intentUsed: fallbackIntent,
  };
}

/**
 * Release context memory if app is suspended
 */
export async function releaseLlamaContext(): Promise<void> {
  if (activeContext) {
    try {
      await activeContext.release();
    } catch (e) {
      console.warn('[LLAMA_SERVICE] Error releasing context:', e);
    }
    activeContext = null;
  }
}

