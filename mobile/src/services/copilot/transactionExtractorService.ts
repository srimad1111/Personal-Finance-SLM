import { ExtractedTransaction, CopilotResponse } from './types';
import { CATEGORIES } from '../../data/mockData';
import { formatINR } from '../../utils/currency';

interface CategoryKeywordMatch {
  categoryId: string;
  categoryName: string;
  type: 'expense' | 'income';
  keywords: string[];
}

const CATEGORY_MATCHERS: CategoryKeywordMatch[] = [
  // Income
  {
    categoryId: 'salary',
    categoryName: 'Salary',
    type: 'income',
    keywords: ['salary', 'paycheck', 'payroll', 'stipend', 'wages', 'credited'],
  },
  {
    categoryId: 'freelance',
    categoryName: 'Freelance & Consulting',
    type: 'income',
    keywords: ['freelance', 'client', 'consulting', 'gig', 'project payment', 'invoice'],
  },
  {
    categoryId: 'investment',
    categoryName: 'Investments & Dividends',
    type: 'income',
    keywords: ['dividend', 'interest earned', 'capital gain', 'mutual fund return', 'fd interest', 'crypto gain'],
  },
  // Expenses
  {
    categoryId: 'groceries',
    categoryName: 'Groceries',
    type: 'expense',
    keywords: ['grocery', 'groceries', 'supermarket', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'vegetables', 'milk', 'provisions'],
  },
  {
    categoryId: 'food_and_dining',
    categoryName: 'Food & Dining',
    type: 'expense',
    keywords: ['dinner', 'lunch', 'breakfast', 'restaurant', 'swiggy', 'zomato', 'cafe', 'starbucks', 'mcdonalds', 'kfc', 'food', 'pizza', 'burger', 'tea', 'coffee'],
  },
  {
    categoryId: 'transportation',
    categoryName: 'Transportation',
    type: 'expense',
    keywords: ['uber', 'ola', 'rapido', 'cab', 'taxi', 'metro', 'petrol', 'fuel', 'diesel', 'toll', 'bus', 'train ticket', 'auto'],
  },
  {
    categoryId: 'shopping',
    categoryName: 'Shopping',
    type: 'expense',
    keywords: ['amazon', 'flipkart', 'myntra', 'clothes', 'shoes', 'electronics', 'shopping', 'zara', 'h&m'],
  },
  {
    categoryId: 'utilities',
    categoryName: 'Bills & Utilities',
    type: 'expense',
    keywords: ['electricity', 'water bill', 'bescom', 'wifi', 'internet bill', 'broadband', 'phone bill', 'recharge', 'airtel', 'jio', 'gas bill', 'cylinder'],
  },
  {
    categoryId: 'housing',
    categoryName: 'Housing & Rent',
    type: 'expense',
    keywords: ['rent', 'maintenance', 'housing', 'mortgage', 'flat', 'apartment maintenance', 'society charges'],
  },
  {
    categoryId: 'entertainment',
    categoryName: 'Entertainment',
    type: 'expense',
    keywords: ['netflix', 'spotify', 'movie', 'cinema', 'pvr', 'theatre', 'gaming', 'prime video', 'hotstar', 'youtube premium'],
  },
  {
    categoryId: 'healthcare',
    categoryName: 'Healthcare',
    type: 'expense',
    keywords: ['doctor', 'hospital', 'medicine', 'pharmacy', 'apollo', 'medplus', 'clinic', 'medical test', 'dental'],
  },
  {
    categoryId: 'education',
    categoryName: 'Education',
    type: 'expense',
    keywords: ['course', 'tuition', 'books', 'school fees', 'udemy', 'coursera', 'exam fee'],
  },
  {
    categoryId: 'travel',
    categoryName: 'Travel',
    type: 'expense',
    keywords: ['flight', 'hotel', 'airbnb', 'vacation', 'makemytrip', 'booking.com', 'resort'],
  },
];

const KNOWN_MERCHANTS: Record<string, { name: string; categoryId: string }> = {
  uber: { name: 'Uber', categoryId: 'transportation' },
  ola: { name: 'Ola', categoryId: 'transportation' },
  rapido: { name: 'Rapido', categoryId: 'transportation' },
  swiggy: { name: 'Swiggy', categoryId: 'food_and_dining' },
  zomato: { name: 'Zomato', categoryId: 'food_and_dining' },
  blinkit: { name: 'Blinkit', categoryId: 'groceries' },
  zepto: { name: 'Zepto', categoryId: 'groceries' },
  instamart: { name: 'Swiggy Instamart', categoryId: 'groceries' },
  bigbasket: { name: 'BigBasket', categoryId: 'groceries' },
  amazon: { name: 'Amazon', categoryId: 'shopping' },
  flipkart: { name: 'Flipkart', categoryId: 'shopping' },
  myntra: { name: 'Myntra', categoryId: 'shopping' },
  netflix: { name: 'Netflix', categoryId: 'entertainment' },
  spotify: { name: 'Spotify', categoryId: 'entertainment' },
  starbucks: { name: 'Starbucks', categoryId: 'food_and_dining' },
  apollo: { name: 'Apollo Pharmacy', categoryId: 'healthcare' },
  airtel: { name: 'Airtel', categoryId: 'utilities' },
  jio: { name: 'Jio', categoryId: 'utilities' },
};

/**
 * Extracts numeric amount supporting ₹, comma separators, and 'k' multiplier.
 */
function extractAmount(text: string): number | null {
  // Check for 'k' notation e.g. 1.2k, 5k
  const kMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1]);
    if (!isNaN(val) && val > 0) {
      return val * 1000;
    }
  }

  // Check for standard numbers e.g. ₹25,000, 500, 1200.50
  const numRegex = /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/gi;
  let match: RegExpExecArray | null;

  while ((match = numRegex.exec(text)) !== null) {
    const cleanStr = match[1].replace(/,/g, '');
    const parsed = parseFloat(cleanStr);
    // Ignore isolated single digits unless currency symbol was present
    if (!isNaN(parsed) && parsed > 0) {
      // If no currency symbol, ensure it's not a day or small number unless plausible amount
      const hasCurrency = /(?:₹|rs\.?|inr)/i.test(match[0]);
      if (hasCurrency || parsed >= 10 || text.toLowerCase().includes('spent') || text.toLowerCase().includes('paid')) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Extracts date relative or formatted.
 */
function extractDate(text: string): string {
  const lower = text.toLowerCase();
  const d = new Date();

  if (lower.includes('yesterday')) {
    d.setDate(d.getDate() - 1);
  } else if (lower.includes('day before yesterday')) {
    d.setDate(d.getDate() - 2);
  }

  return d.toISOString().split('T')[0];
}

/**
 * Checks if the text looks like a natural-language transaction entry.
 */
export function isTransactionStatement(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // Exclusion patterns: general queries should NOT be treated as transactions
  if (
    lower.startsWith('what') ||
    lower.startsWith('how') ||
    lower.startsWith('which') ||
    lower.startsWith('where') ||
    lower.startsWith('why') ||
    lower.startsWith('when') ||
    lower.startsWith('can you') ||
    lower.startsWith('explain') ||
    lower.startsWith('tell me') ||
    lower.startsWith('show') ||
    lower.startsWith('compare') ||
    lower.includes('should i') ||
    lower.includes('am i') ||
    lower.includes('rule') ||
    lower.includes('what is')
  ) {
    return false;
  }

  // Inclusion patterns
  const expenseVerbs = ['spent', 'paid', 'bought', 'purchased', 'ordered', 'spending', 'charged'];
  const incomeVerbs = ['received', 'got', 'credited', 'earned', 'salary credited', 'freelance payment'];

  const hasExpenseVerb = expenseVerbs.some((v) => lower.includes(v));
  const hasIncomeVerb = incomeVerbs.some((v) => lower.includes(v));
  const hasAmount = extractAmount(text) !== null;

  return (hasExpenseVerb || hasIncomeVerb) && hasAmount;
}

/**
 * Parses natural-language transaction statement into structured entity.
 */
export function extractTransactionFromText(text: string): ExtractedTransaction | null {
  const lower = text.toLowerCase().trim();
  const amount = extractAmount(text);

  if (!amount) {
    return null;
  }

  // Determine type
  const incomeKeywords = ['received', 'got', 'credited', 'salary', 'freelance', 'earned', 'inflow'];
  const isIncome = incomeKeywords.some((w) => lower.includes(w));
  const type: 'expense' | 'income' = isIncome ? 'income' : 'expense';

  // Identify merchant
  let identifiedMerchant: string | undefined = undefined;
  let categoryFromMerchant: string | undefined = undefined;

  for (const [key, mInfo] of Object.entries(KNOWN_MERCHANTS)) {
    if (lower.includes(key)) {
      identifiedMerchant = mInfo.name;
      categoryFromMerchant = mInfo.categoryId;
      break;
    }
  }

  // Identify category
  let matchedCategoryId = categoryFromMerchant || (type === 'income' ? 'salary' : 'misc');
  let matchedCategoryName = 'Miscellaneous';

  for (const matcher of CATEGORY_MATCHERS) {
    if (matcher.type === type) {
      if (matcher.keywords.some((kw) => lower.includes(kw))) {
        matchedCategoryId = matcher.categoryId;
        matchedCategoryName = matcher.categoryName;
        break;
      }
    }
  }

  // Fallback category metadata
  const meta = (CATEGORIES as Record<string, any>)[matchedCategoryId];
  if (meta) {
    matchedCategoryName = meta.name;
  }

  // Build clean description
  let description = identifiedMerchant || matchedCategoryName;
  if (lower.includes('for uber') || lower.includes('uber')) description = 'Uber Ride';
  else if (lower.includes('for dinner') || lower.includes('dinner')) description = 'Dinner';
  else if (lower.includes('for lunch') || lower.includes('lunch')) description = 'Lunch';
  else if (lower.includes('groceries') || lower.includes('grocery')) description = 'Grocery Restock';
  else if (lower.includes('salary')) description = 'Monthly Salary';
  else if (lower.includes('freelance')) description = 'Freelance Work';

  const date = extractDate(text);

  return {
    type,
    amount,
    category: matchedCategoryId,
    categoryName: matchedCategoryName,
    merchant: identifiedMerchant,
    description,
    date,
  };
}

/**
 * Handles transaction extraction and prepares preview confirmation response.
 * CRITICAL SAFETY: Does NOT insert into SQLite automatically.
 */
export function handleTransactionUnderstandingQuery(
  userQuery: string
): CopilotResponse {
  const extracted = extractTransactionFromText(userQuery);

  if (!extracted) {
    return {
      text: "I noticed you mentioned a transaction, but couldn't verify the amount. Please specify the amount in Rupees (e.g., 'I spent ₹500 on groceries' or 'Received ₹25,000 as salary').",
      intent: 'TRANSACTION_CLARIFICATION',
      categoryGroup: 'TRANSACTION',
    };
  }

  const sign = extracted.type === 'income' ? '+' : '-';
  const previewText = `I have parsed your ${extracted.type} details:\n\n• Amount: ${sign}${formatINR(
    extracted.amount
  )}\n• Category: ${extracted.categoryName}\n• Description: ${extracted.description}${
    extracted.merchant ? `\n• Merchant: ${extracted.merchant}` : ''
  }\n• Date: ${extracted.date}\n\nWould you like me to record this in your local SQLite ledger? Tap "Confirm" below to save.`;

  return {
    text: previewText,
    intent: 'TRANSACTION_PREVIEW',
    categoryGroup: 'TRANSACTION',
    transactionPreview: extracted,
    insight: {
      type: 'metric',
      title: 'Transaction Preview (Pending)',
      value: `${sign}${formatINR(extracted.amount)}`,
      details: `${extracted.categoryName} · ${extracted.date}`,
    },
    suggestedPrompts: [
      'Confirm & Record',
      'Cancel',
    ],
  };
}

