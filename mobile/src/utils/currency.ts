/**
 * currency.ts
 * -----------
 * Reusable Indian Rupee (INR - ₹) formatting utility for Personal Finance SLM.
 * Formats monetary amounts using the Indian numbering system (en-IN):
 *   - ₹450
 *   - ₹12,500
 *   - ₹1,50,000
 *   - ₹10,00,000
 * Handles negative values, zero, decimals, compact formats, and sign prefixes.
 */

export interface CurrencyFormatOptions {
  /** Whether to include the Rupee symbol '₹' (default: true) */
  showSymbol?: boolean;
  /** Number of decimal places to display (default: 2) */
  decimals?: number;
  /** Whether to prefix positive amounts with '+' (default: false) */
  showSign?: boolean;
  /** Whether to format in compact representation e.g. 1.5L or 2.5K (default: false) */
  compact?: boolean;
}

export const CURRENCY_SYMBOL = '₹';
export const CURRENCY_CODE = 'INR';

/**
 * Formats a raw number string or integer according to the Indian grouping system:
 * (e.g. 1,00,000 instead of 100,000).
 */
export function formatIndianGrouping(value: number, decimals: number = 2): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const fixed = absValue.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  let formattedInt = intPart;
  if (intPart.length > 3) {
    const lastThree = intPart.substring(intPart.length - 3);
    const leadingDigits = intPart.substring(0, intPart.length - 3);
    formattedInt = leadingDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  const result = decimals > 0 ? `${formattedInt}.${decPart}` : formattedInt;
  return isNegative ? `-${result}` : result;
}

/**
 * Primary formatting function for Indian Rupee amounts.
 * Examples:
 *   formatINR(450) -> "₹450.00"
 *   formatINR(150000) -> "₹1,50,000.00"
 *   formatINR(-2500) -> "-₹2,500.00"
 *   formatINR(8500, { showSign: true }) -> "+₹8,500.00"
 *   formatINR(12000, { showSymbol: false }) -> "12,000.00"
 */
export function formatINR(amount: number | null | undefined, options: CurrencyFormatOptions = {}): string {
  const {
    showSymbol = true,
    decimals = 2,
    showSign = false,
    compact = false,
  } = options;

  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? `${CURRENCY_SYMBOL}0.00` : '0.00';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  // Compact representation for chart axes / compact badges
  if (compact) {
    let compactStr = '';
    if (absAmount >= 10000000) {
      compactStr = `${(absAmount / 10000000).toFixed(1)}Cr`;
    } else if (absAmount >= 100000) {
      compactStr = `${(absAmount / 100000).toFixed(1)}L`;
    } else if (absAmount >= 1000) {
      compactStr = `${(absAmount / 1000).toFixed(1)}k`;
    } else {
      compactStr = absAmount.toFixed(0);
    }
    const prefix = isNegative ? '-' : (showSign && amount > 0 ? '+' : '');
    return showSymbol ? `${prefix}${CURRENCY_SYMBOL}${compactStr}` : `${prefix}${compactStr}`;
  }

  // Format with Indian grouping
  let formattedNumber: string;
  try {
    // Attempt standard Intl API
    formattedNumber = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(absAmount);
  } catch {
    // Robust regex fallback
    formattedNumber = formatIndianGrouping(absAmount, decimals);
  }

  const symbolStr = showSymbol ? CURRENCY_SYMBOL : '';

  if (isNegative) {
    return `-${symbolStr}${formattedNumber}`;
  }

  const signStr = showSign && amount > 0 ? '+' : '';
  return `${signStr}${symbolStr}${formattedNumber}`;
}

/**
 * Format helper specifically for transaction delta displays (+₹450.00 or -₹1,200.00)
 */
export function formatTransactionAmount(amount: number, type: 'income' | 'expense'): string {
  const abs = Math.abs(amount);
  const sign = type === 'income' ? '+' : '-';
  return `${sign}${CURRENCY_SYMBOL}${formatIndianGrouping(abs, 2)}`;
}

