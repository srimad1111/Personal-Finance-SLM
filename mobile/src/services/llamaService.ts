/**
 * Native llama.cpp Inference Service for Personal Finance SLM
 *
 * Built strictly against installed package: llama.rn (v0.13.0-rc.9)
 *
 * Responsibilities:
 * - Local GGUF model lifecycle management (CPU inference, mmap, conservative context)
 * - Concurrent generation safety and cancellation handling
 * - Clean streaming token callbacks
 * - Gemma 3 prompt template formatting (model-provided Jinja + fallback)
 * - Complete error handling without mock/simulated responses
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import {
  initLlama,
  LlamaContext,
  TokenData,
  NativeCompletionResult,
  RNLlamaOAICompatibleMessage,
} from 'llama.rn';
import {
  getFinancialSummary,
  getCategoryWiseTotals,
  getMonthlyTrends,
  getBudgetProgress,
} from '../database';
import { formatINR } from '../utils/currency';
import { ChatMessage } from '../types';

// ==============================================================================
// Types & Interfaces
// ==============================================================================

export type ModelLifecycleState =
  | 'unloaded'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'error';

export interface ModelInitOptions {
  /** Conservative token context window (default: 2048) */
  contextSize?: number;
  /** CPU thread count (default: 4 for modern ARM64 big cores) */
  threadCount?: number;
  /** Memory-mapped file access (default: true) */
  useMmap?: boolean;
  /** Batch size (default: 512) */
  batchSize?: number;
  /** Progress callback during model file initialization */
  onProgress?: (progress: number) => void;
}

export interface GenerateOptions {
  /** Maximum new tokens to generate (default: 256) */
  maxTokens?: number;
  /** Sampling temperature (default: 0.1 for deterministic financial logic) */
  temperature?: number;
  /** Top-P nucleus sampling (default: 0.95) */
  topP?: number;
  /** Stop tokens / sequences */
  stopSequences?: string[];
}

export interface GenerateCallbacks {
  /** Fired whenever a new token is generated */
  onToken?: (token: string, accumulated: string) => void;
  /** Fired when complete generation finishes */
  onComplete?: (fullText: string) => void;
  /** Fired on error */
  onError?: (error: Error) => void;
}

export interface ServiceStatus {
  state: ModelLifecycleState;
  modelPath: string | null;
  error: string | null;
  contextParams?: {
    contextSize: number;
    threadCount: number;
    useMmap: boolean;
  };
}

export interface Gemma3ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Backward compatibility types for existing screens
export interface ModelStatus {
  available: boolean;
  path: string;
  sizeBytes?: number;
  sizeFormatted?: string;
  isNativeSupported: boolean;
}

export const MODEL_FILENAME = 'personal-finance-slm-Q4_K_M.gguf';
export const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
export const TARGET_MODEL_PATH = `${MODEL_DIR}${MODEL_FILENAME}`;

// ==============================================================================
// Custom Error Hierarchy
// ==============================================================================

export class LlamaServiceError extends Error {
  code:
    | 'MODEL_NOT_FOUND'
    | 'INVALID_MODEL_PATH'
    | 'UNSUPPORTED_PLATFORM'
    | 'ALREADY_INITIALIZING'
    | 'NOT_INITIALIZED'
    | 'ALREADY_GENERATING'
    | 'INITIALIZATION_FAILED'
    | 'GENERATION_FAILED'
    | 'GENERATION_CANCELLED'
    | 'RELEASE_FAILED';

  constructor(
    code: LlamaServiceError['code'],
    message: string,
    public originalError?: unknown
  ) {
    super(`[LlamaService:${code}] ${message}`);
    this.name = 'LlamaServiceError';
    this.code = code;
  }
}

// ==============================================================================
// Gemma 3 Chat Template Helpers (Decoupled from native lifecycle)
// ==============================================================================

/**
 * Formats a conversation according to the canonical Google Gemma 3 prompt template:
 *
 * <start_of_turn>user
 * [System instruction if any]
 *
 * [User query]<end_of_turn>
 * <start_of_turn>model
 * [Model response]<end_of_turn>
 * <start_of_turn>model
 *
 * Note: Gemma does not support `<start_of_turn>system`. System instructions
 * are prepended to the first user turn.
 */
export function formatGemma3Chat(
  messages: Gemma3ChatMessage[],
  options: { addGenerationPrompt?: boolean } = { addGenerationPrompt: true }
): string {
  let prompt = '';
  let pendingSystem = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      const content = msg.content.trim();
      if (content) {
        pendingSystem = pendingSystem ? `${pendingSystem}\n\n${content}` : content;
      }
    } else if (msg.role === 'user') {
      prompt += '<start_of_turn>user\n';
      if (pendingSystem) {
        prompt += `${pendingSystem}\n\n`;
        pendingSystem = ''; // Prepended once into the first user turn
      }
      prompt += `${msg.content.trim()}<end_of_turn>\n`;
    } else if (msg.role === 'assistant') {
      prompt += `<start_of_turn>model\n${msg.content.trim()}<end_of_turn>\n`;
    }
  }

  // Handle standalone system prompt if no user message was provided
  if (pendingSystem && !prompt) {
    prompt += `<start_of_turn>user\n${pendingSystem}<end_of_turn>\n`;
  }

  if (options.addGenerationPrompt) {
    prompt += '<start_of_turn>model\n';
  }

  return prompt;
}

/**
 * Convenience formatter for single instruction queries (e.g. SLM financial categorization)
 */
export function formatGemma3Instruction(taskDescription: string, inputPayload: string): string {
  return formatGemma3Chat([
    {
      role: 'user',
      content: `${taskDescription.trim()}\n\n${inputPayload.trim()}`,
    },
  ]);
}

// ==============================================================================
// LlamaService Class Implementation
// ==============================================================================

export class LlamaService {
  private activeContext: LlamaContext | null = null;
  private currentState: ModelLifecycleState = 'unloaded';
  private currentModelPath: string | null = null;
  private lastError: string | null = null;

  // Concurrency and lifecycle safety trackers
  private activeGenerationPromise: Promise<string> | null = null;
  private isCancelling = false;
  private isInitializing = false;
  private isReleasing = false;

  private currentContextParams?: {
    contextSize: number;
    threadCount: number;
    useMmap: boolean;
  };

  /**
   * Current lifecycle state of the model
   */
  public getModelStatus(): ServiceStatus {
    return {
      state: this.currentState,
      modelPath: this.currentModelPath,
      error: this.lastError,
      contextParams: this.currentContextParams,
    };
  }

  /**
   * Initializes the GGUF model via llama.rn.
   *
   * @param modelPath Absolute file path to the .gguf model on the device filesystem.
   * @param options Initialization options (context size, threads, mmap).
   */
  public async initializeModel(
    modelPath: string,
    options: ModelInitOptions = {}
  ): Promise<void> {
    if (!modelPath || typeof modelPath !== 'string') {
      throw new LlamaServiceError('INVALID_MODEL_PATH', 'A valid non-empty modelPath string must be provided.');
    }

    if (this.isInitializing || this.currentState === 'loading') {
      throw new LlamaServiceError(
        'ALREADY_INITIALIZING',
        'Model initialization is already in progress. Wait for it to complete.'
      );
    }

    if (this.activeGenerationPromise || this.currentState === 'generating' || this.isCancelling) {
      throw new LlamaServiceError(
        'ALREADY_GENERATING',
        'Cannot initialize model while generation or cancellation is in progress.'
      );
    }

    if (this.currentState === 'ready' && this.currentModelPath === modelPath && this.activeContext) {
      // Already initialized with identical path
      return;
    }

    this.isInitializing = true;

    try {
      // Release existing context if swapping model
      if (this.activeContext) {
        await this.releaseModel();
      }

      // Verify platform support
      if (Platform.OS === 'web') {
        this.currentState = 'error';
        this.lastError = 'llama.rn native inference is not supported on web.';
        throw new LlamaServiceError('UNSUPPORTED_PLATFORM', 'llama.rn requires an Android or iOS device runtime.');
      }

      // Verify model file existence
      try {
        const fileInfo = await FileSystem.getInfoAsync(modelPath);
        if (!fileInfo.exists || fileInfo.isDirectory || (fileInfo.size && fileInfo.size < 1024)) {
          this.currentState = 'error';
          this.lastError = `Model file does not exist or is invalid at: ${modelPath}`;
          throw new LlamaServiceError(
            'MODEL_NOT_FOUND',
            `GGUF model file was not found or is empty at: ${modelPath}`
          );
        }
      } catch (fsErr) {
        if (fsErr instanceof LlamaServiceError) throw fsErr;
        this.currentState = 'error';
        this.lastError = `Filesystem check failed for: ${modelPath}`;
        throw new LlamaServiceError('MODEL_NOT_FOUND', `Failed to access file path: ${modelPath}`, fsErr);
      }

      // Configure params
      const contextSize = options.contextSize ?? 2048;
      const threadCount = options.threadCount ?? 4;
      const useMmap = options.useMmap ?? true;
      const batchSize = options.batchSize ?? 512;

      this.currentState = 'loading';
      this.lastError = null;

      try {
        this.activeContext = await initLlama(
          {
            model: modelPath,
            is_model_asset: false,
            n_ctx: contextSize,
            n_threads: threadCount,
            n_batch: batchSize,
            use_mmap: useMmap,
            n_gpu_layers: 0, // Conservative CPU baseline
          },
          (progress) => {
            if (options.onProgress) {
              options.onProgress(progress);
            }
          }
        );

        this.currentState = 'ready';
        this.currentModelPath = modelPath;
        this.currentContextParams = {
          contextSize,
          threadCount,
          useMmap,
        };
      } catch (initErr) {
        this.currentState = 'error';
        if (this.activeContext) {
          try {
            await this.activeContext.release();
          } catch {
            // Ignore native release error on failed initialization
          }
        }
        this.activeContext = null;
        this.lastError = initErr instanceof Error ? initErr.message : String(initErr);
        throw new LlamaServiceError(
          'INITIALIZATION_FAILED',
          `llama.rn failed to initialize model context: ${this.lastError}`,
          initErr
        );
      }
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Generates a text response from the model.
   *
   * Concurrency & Double-formatting guarantees:
   * - If promptOrMessages is a string, it is passed directly as `prompt` without re-formatting.
   * - If promptOrMessages is an array of messages, llama.rn applies the GGUF model's embedded Jinja chat template.
   * - Only one generation can run at a time; concurrent calls reject with ALREADY_GENERATING.
   *
   * @param promptOrMessages Pre-formatted prompt string or OpenAI-compatible messages array.
   * @param callbacks Optional callbacks for token streaming and completion.
   * @param options Completion options (maxTokens, temperature, stopSequences).
   * @returns The complete generated text.
   */
  public async generateResponse(
    promptOrMessages: string | RNLlamaOAICompatibleMessage[],
    callbacks?: GenerateCallbacks,
    options?: GenerateOptions
  ): Promise<string> {
    if (this.activeGenerationPromise || this.currentState === 'generating' || this.isCancelling) {
      throw new LlamaServiceError(
        'ALREADY_GENERATING',
        'Model is already generating a response or cancelling. Wait for it to settle.'
      );
    }

    if (!this.activeContext || this.currentState !== 'ready') {
      throw new LlamaServiceError(
        'NOT_INITIALIZED',
        'Model is not ready for generation. Call initializeModel() first.'
      );
    }

    const generationTask = (async (): Promise<string> => {
      this.currentState = 'generating';
      this.isCancelling = false;
      let accumulatedText = '';

      const maxTokens = options?.maxTokens ?? 256;
      const temperature = options?.temperature ?? 0.1;
      const topP = options?.topP ?? 0.95;
      // Gemma 3 stops: <end_of_turn> (canonical turn end), <eos> (end of sequence), <start_of_turn> (safety guard against runaway multi-turn generation)
      const stopSequences = options?.stopSequences ?? ['<end_of_turn>', '<eos>', '<start_of_turn>'];

      try {
        let completionResult: NativeCompletionResult;

        const onTokenCallback = (data: TokenData) => {
          if (this.isCancelling) return;
          const newChunk = data.token ?? '';
          if (!newChunk && !data.accumulated_text) return;

          if (data.accumulated_text !== undefined) {
            accumulatedText = data.accumulated_text;
          } else {
            accumulatedText += newChunk;
          }

          if (callbacks?.onToken && newChunk) {
            callbacks.onToken(newChunk, accumulatedText);
          }
        };

        if (typeof promptOrMessages === 'string') {
          completionResult = await this.activeContext!.completion(
            {
              prompt: promptOrMessages,
              n_predict: maxTokens,
              temperature,
              top_p: topP,
              stop: stopSequences,
            },
            onTokenCallback
          );
        } else {
          // Native model-provided chat template formatting via messages array
          completionResult = await this.activeContext!.completion(
            {
              messages: promptOrMessages,
              n_predict: maxTokens,
              temperature,
              top_p: topP,
              stop: stopSequences,
            },
            onTokenCallback
          );
        }

        if (this.isCancelling || completionResult.interrupted) {
          throw new LlamaServiceError('GENERATION_CANCELLED', 'Inference generation was cancelled.');
        }

        // Prefer parsed content, fallback to raw text or accumulated tokens
        const rawOutput = completionResult.content || completionResult.text || accumulatedText;
        const finalOutput = (rawOutput || '').trim();

        if (callbacks?.onComplete) {
          callbacks.onComplete(finalOutput);
        }
        return finalOutput;
      } catch (genErr) {
        if (
          this.isCancelling ||
          (genErr instanceof LlamaServiceError && genErr.code === 'GENERATION_CANCELLED')
        ) {
          const cancelErr = new LlamaServiceError('GENERATION_CANCELLED', 'Inference generation was cancelled.');
          if (callbacks?.onError) {
            callbacks.onError(cancelErr);
          }
          throw cancelErr;
        }

        const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
        const serviceErr = new LlamaServiceError('GENERATION_FAILED', `Generation failed: ${errMsg}`, genErr);
        if (callbacks?.onError) {
          callbacks.onError(serviceErr);
        }
        throw serviceErr;
      } finally {
        this.activeGenerationPromise = null;
        this.isCancelling = false;
        if (this.activeContext) {
          this.currentState = 'ready';
        } else {
          this.currentState = 'unloaded';
        }
      }
    })();

    this.activeGenerationPromise = generationTask;
    return generationTask;
  }

  /**
   * Cancels any active generation using the native llama.rn stopCompletion API
   * and awaits until the in-flight completion promise has completely settled.
   */
  public async cancelGeneration(): Promise<void> {
    if (!this.activeGenerationPromise && this.currentState !== 'generating') {
      return;
    }

    this.isCancelling = true;

    if (this.activeContext) {
      try {
        await this.activeContext.stopCompletion();
      } catch (err) {
        console.warn('[LlamaService] Error calling stopCompletion():', err);
      }
    }

    if (this.activeGenerationPromise) {
      try {
        await this.activeGenerationPromise;
      } catch {
        // Expected GENERATION_CANCELLED rejection
      }
    }
  }

  /**
   * Releases native context memory and cleans up JNI resources.
   * Ensures active generation is fully cancelled and drained before releasing context.
   */
  public async releaseModel(): Promise<void> {
    if (this.isReleasing) {
      return;
    }
    this.isReleasing = true;

    try {
      if (this.activeGenerationPromise || this.currentState === 'generating') {
        await this.cancelGeneration();
      }

      if (this.activeContext) {
        try {
          await this.activeContext.release();
        } catch (relErr) {
          console.warn('[LlamaService] Error releasing native context:', relErr);
        }
      }
    } finally {
      this.activeContext = null;
      this.currentState = 'unloaded';
      this.currentModelPath = null;
      this.currentContextParams = undefined;
      this.activeGenerationPromise = null;
      this.isCancelling = false;
      this.isReleasing = false;
    }
  }
}

// ==============================================================================
// Singleton Export
// ==============================================================================

export const llamaService = new LlamaService();

// ==============================================================================
// Screen Compatibility Helpers (Preserves existing AiAssistantScreen imports)
// ==============================================================================

export async function checkModelStatus(): Promise<ModelStatus> {
  const isNativeSupported = Platform.OS === 'android' || Platform.OS === 'ios';

  try {
    const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
    }

    const fileInfo = await FileSystem.getInfoAsync(TARGET_MODEL_PATH);
    if (fileInfo.exists && !fileInfo.isDirectory) {
      const bytes = fileInfo.size || 0;
      const formatted =
        bytes >= 1024 * 1024 * 1024
          ? `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
          : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

      return {
        available: true,
        path: TARGET_MODEL_PATH,
        sizeBytes: bytes,
        sizeFormatted: formatted,
        isNativeSupported,
      };
    }
  } catch (err) {
    console.warn('[LlamaService] Error checking status:', err);
  }

  return {
    available: false,
    path: TARGET_MODEL_PATH,
    isNativeSupported,
  };
}

export async function importModelFromUri(
  sourceUri: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }

  if (onProgress) onProgress(0.1);

  await FileSystem.copyAsync({
    from: sourceUri,
    to: TARGET_MODEL_PATH,
  });

  if (onProgress) onProgress(1.0);

  const verified = await checkModelStatus();
  return verified.available;
}

export async function runOfflineQueryInference(
  userQuery: string
): Promise<{ text: string; insight?: ChatMessage['financialInsight']; intentUsed?: string }> {
  // If model is available in sandbox, ensure service initializes it
  const status = await checkModelStatus();
  if (status.available && llamaService.getModelStatus().state === 'unloaded') {
    try {
      await llamaService.initializeModel(TARGET_MODEL_PATH);
    } catch (e) {
      console.warn('[LlamaService] Auto-init failed, falling back:', e);
    }
  }

  // If service is ready, run inference using Gemma 3 template
  if (llamaService.getModelStatus().state === 'ready') {
    try {
      const prompt = formatGemma3Instruction('Financial Query Understanding', `Question: ${userQuery.trim()}`);
      const output = await llamaService.generateResponse(prompt, undefined, { maxTokens: 96, temperature: 0.1 });

      const jsonMatch = output.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.intent) {
          const result = await executeDeterministicQueryFromIntent(parsed.intent, parsed.category);
          return { ...result, intentUsed: parsed.intent };
        }
      }
    } catch (e) {
      console.warn('[LlamaService] Generation/parsing error, falling back:', e);
    }
  }

  // Deterministic router fallback
  const lower = userQuery.toLowerCase();
  let intent = 'general_balance';
  let category: string | undefined = undefined;

  if (lower.includes('highest') || lower.includes('largest') || lower.includes('most spent')) {
    intent = 'highest_spending_category';
  } else if (lower.includes('budget') || lower.includes('limit')) {
    intent = 'budget_status';
  } else if (lower.includes('summary') || lower.includes('savings')) {
    intent = 'monthly_summary';
  } else if (lower.includes('income') || lower.includes('earn')) {
    intent = 'total_income';
  } else if (lower.includes('spend') || lower.includes('expense')) {
    const categories = ['food', 'shopping', 'transport', 'groceries', 'bills', 'rent'];
    for (const c of categories) {
      if (lower.includes(c)) {
        intent = 'category_spending';
        category = c;
        break;
      }
    }
    if (!category) intent = 'total_expenses';
  }

  const res = await executeDeterministicQueryFromIntent(intent, category);
  return { ...res, intentUsed: intent };
}

async function executeDeterministicQueryFromIntent(
  intent: string,
  category?: string
): Promise<{ text: string; insight?: ChatMessage['financialInsight'] }> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const monthStartDate = `${currentYear}-${currentMonthStr}-01`;

  switch (intent) {
    case 'total_expenses': {
      const summary = await getFinancialSummary(monthStartDate);
      return {
        text: `Your total recorded expenses for this month are ${formatINR(summary.totalExpenses)}, evaluated deterministically from ${summary.transactionCount} transactions in your local SQLite ledger.`,
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
        text: `Your total recorded income for this month is ${formatINR(summary.totalIncome)}, stored in your offline SQLite database.`,
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
      const target = category?.toLowerCase() || '';
      const matched = categoryTotals.find(
        (c) => c.categoryName.toLowerCase().includes(target) || c.categoryId.toLowerCase().includes(target)
      );

      if (matched) {
        return {
          text: `You have spent ${formatINR(matched.totalAmount)} on ${matched.categoryName} this month (${matched.percentage.toFixed(1)}% of total outflows across ${matched.transactionCount} transactions).`,
          insight: {
            type: 'breakdown',
            title: `Category: ${matched.categoryName}`,
            value: formatINR(matched.totalAmount),
            details: `${matched.percentage.toFixed(1)}% of monthly spend`,
          },
        };
      }
      return {
        text: `No expenses found for category "${category || 'specified'}" this month in your SQLite ledger.`,
        insight: {
          type: 'metric',
          title: category ? `Category: ${category}` : 'Category Outflow',
          value: formatINR(0),
          details: '0 transactions found in period',
        },
      };
    }
    case 'highest_spending_category': {
      const categoryTotals = await getCategoryWiseTotals('expense', monthStartDate);
      const top = categoryTotals.length > 0 ? categoryTotals[0] : null;
      if (top) {
        return {
          text: `Your highest spending category this month is ${top.categoryName} with ${formatINR(top.totalAmount)} (${top.percentage.toFixed(1)}% of all expenses).`,
          insight: {
            type: 'breakdown',
            title: `Top Outflow: ${top.categoryName}`,
            value: formatINR(top.totalAmount),
            details: `${top.percentage.toFixed(1)}% across ${top.transactionCount} records`,
          },
        };
      }
      return { text: 'No expense records found in your SQLite ledger yet.' };
    }
    case 'monthly_summary': {
      const summary = await getFinancialSummary(monthStartDate);
      const savings = summary.totalIncome - summary.totalExpenses;
      const rate = summary.totalIncome > 0 ? (savings / summary.totalIncome) * 100 : 0;
      return {
        text: `Deterministic Monthly Ledger Summary:\n\n• Inflow: ${formatINR(summary.totalIncome)}\n• Outflow: ${formatINR(summary.totalExpenses)}\n• Net Savings: ${formatINR(savings)} (${rate.toFixed(1)}% rate)\n\nCalculated offline across ${summary.transactionCount} verified SQLite entries.`,
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
        text: `Budget Status for ${now.toLocaleString('default', { month: 'long' })}:\n\n• Limit: ${formatINR(totalLimit)}\n• Spent: ${formatINR(totalSpent)}\n• Safe to Spend: ${formatINR(remaining)}`,
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
        text: `Your current net balance in SQLite is ${formatINR(summary.netBalance)} with lifetime income of ${formatINR(summary.totalIncome)} and expenses of ${formatINR(summary.totalExpenses)}.`,
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
