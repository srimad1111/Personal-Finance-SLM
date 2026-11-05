/**
 * Web Shim for llama.rn
 *
 * Prevents TurboModuleRegistry.get('RNLlama') crashes on Web.
 * Native llama.cpp / JNI inference runs exclusively on Android/iOS native runtimes.
 */

export interface TokenData {
  token: number;
  word: string;
}

export interface NativeCompletionResult {
  text: string;
  tokens_predicted: number;
  tokens_evaluated: number;
  truncated: boolean;
  stopped_eos: boolean;
  stopped_word: boolean;
  stopping_word: string;
  tokens_cached: number;
  timings?: {
    predicted_per_token_ms: number;
    predicted_per_second: number;
    evaluated_per_token_ms: number;
    evaluated_per_second: number;
  };
}

export interface RNLlamaOAICompatibleMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlamaContext {
  async release(): Promise<void> {}
  async stopCompletion(): Promise<void> {}
  async completion(): Promise<NativeCompletionResult> {
    throw new Error('Native inference is not supported on web.');
  }
  async tokenize(): Promise<number[]> {
    return [];
  }
  async detokenize(): Promise<string> {
    return '';
  }
}

export async function initLlama(): Promise<LlamaContext> {
  throw new Error('llama.rn native inference requires an Android or iOS device runtime.');
}

export async function installJsi(): Promise<boolean> {
  return false;
}

export const RNLLAMA_MTMD_DEFAULT_MEDIA_MARKER = '<__media__>';
export function lookupVoice(): null {
  return null;
}
export function listVoices(): string[] {
  return [];
}
export function listLanguages(): string[] {
  return [];
}

export default {
  initLlama,
  installJsi,
  LlamaContext,
};

