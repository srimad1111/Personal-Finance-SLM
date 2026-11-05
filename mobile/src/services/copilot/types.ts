import { ChatMessage, TransactionType, TransactionCategory } from '../../types';

// ==============================================================================
// Intent Categories
// ==============================================================================

export type PersonalFinanceIntent =
  | 'TOTAL_BALANCE'
  | 'TOTAL_INCOME'
  | 'TOTAL_EXPENSES'
  | 'MONTHLY_SUMMARY'
  | 'DAILY_SUMMARY'
  | 'CATEGORY_EXPENSES'
  | 'HIGHEST_SPENDING_CATEGORY'
  | 'HIGHEST_EXPENSE'
  | 'RECENT_TRANSACTIONS'
  | 'SAVINGS'
  | 'SAVINGS_RATE'
  | 'MONTHLY_COMPARISON'
  | 'TRANSACTION_SEARCH';

export type GeneralKnowledgeIntent =
  | 'SIP_EXPLANATION'
  | 'MUTUAL_FUNDS'
  | 'COMPOUND_INTEREST'
  | 'INFLATION'
  | 'EMERGENCY_FUND'
  | 'CREDIT_SCORE'
  | 'ASSET_LIABILITY'
  | 'DIVERSIFICATION'
  | 'STOCK_MARKET_BASICS'
  | 'BUDGETING_EDUCATION'
  | 'INVESTMENT_BASICS'
  | 'GENERAL_FINANCIAL_QUESTION';

export type BudgetIntent =
  | 'TOTAL_BUDGET'
  | 'BUDGET_REMAINING'
  | 'CATEGORY_BUDGET'
  | 'BUDGET_UTILIZATION'
  | 'BUDGET_WARNING'
  | 'SAFE_TO_SPEND'
  | 'OVER_BUDGET_CATEGORY';

export type InsightsIntent =
  | 'SPENDING_INSIGHTS'
  | 'SAVINGS_RECOMMENDATIONS'
  | 'EXPENSE_REDUCTION'
  | 'SPENDING_PATTERN_ANALYSIS'
  | 'BUDGET_RECOMMENDATIONS'
  | 'SAVINGS_IMPROVEMENT';

export type TransactionUnderstandingIntent =
  | 'CREATE_EXPENSE_INTENT'
  | 'CREATE_INCOME_INTENT'
  | 'TRANSACTION_CATEGORIZATION'
  | 'TRANSACTION_ENTITY_EXTRACTION'
  | 'TRANSACTION_DATE_EXTRACTION'
  | 'TRANSACTION_CLARIFICATION'
  | 'TRANSACTION_PREVIEW';

export type AmbiguousIntent =
  | 'AMBIGUOUS_QUESTION'
  | 'UNSUPPORTED_QUESTION'
  | 'CLARIFICATION_NEEDED';

export type CopilotIntent =
  | PersonalFinanceIntent
  | GeneralKnowledgeIntent
  | BudgetIntent
  | InsightsIntent
  | TransactionUnderstandingIntent
  | AmbiguousIntent;

export type IntentCategoryGroup =
  | 'PERSONAL_FINANCE'
  | 'GENERAL_KNOWLEDGE'
  | 'BUDGET'
  | 'INSIGHTS'
  | 'TRANSACTION'
  | 'AMBIGUOUS';

// ==============================================================================
// Entities and Parameters
// ==============================================================================

export type DatePeriod = 'CURRENT_MONTH' | 'LAST_MONTH' | 'CURRENT_DAY' | 'LIFETIME' | 'CUSTOM';

export interface ExtractedEntities {
  category?: TransactionCategory | string;
  categoryName?: string;
  merchant?: string;
  amount?: number;
  date?: string; // YYYY-MM-DD
  period?: DatePeriod;
  targetMonth?: number; // 1 - 12
  targetYear?: number;
  transactionType?: TransactionType;
  searchQuery?: string;
  description?: string;
  rank?: number; // e.g. 1 for highest, 2 for next highest
}

export interface ClassificationResult {
  intent: CopilotIntent;
  categoryGroup: IntentCategoryGroup;
  confidence: number;
  entities: ExtractedEntities;
  isFollowUp?: boolean;
  rawExplanationTopic?: string;
}

export interface ExtractedTransaction {
  type: TransactionType;
  amount: number;
  category: string;
  categoryName: string;
  description: string;
  merchant?: string;
  date: string;
  confirmed?: boolean;
  cancelled?: boolean;
}

export interface ConversationContext {
  lastIntent?: CopilotIntent;
  lastCategory?: string;
  lastCategoryName?: string;
  lastPeriod?: DatePeriod;
  lastMonth?: number;
  lastYear?: number;
  lastTransactionType?: TransactionType;
  lastEntity?: string;
  pendingTransaction?: ExtractedTransaction;
  lastCategoryRank?: number;
}

export interface CopilotResponse {
  text: string;
  insight?: ChatMessage['financialInsight'];
  intent: CopilotIntent;
  categoryGroup: IntentCategoryGroup;
  transactionPreview?: ExtractedTransaction;
  suggestedPrompts?: string[];
}

