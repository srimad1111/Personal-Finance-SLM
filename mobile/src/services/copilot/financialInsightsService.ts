import { InsightsIntent, CopilotResponse, ExtractedEntities } from './types';
import {
  getFinancialSummary,
  getCategoryWiseTotals,
  getAllTransactions,
} from '../../database';
import { formatINR } from '../../utils/currency';
import { LlamaService, formatGemma3Instruction } from '../llamaService';

const DISCRETIONARY_CATEGORIES = new Set([
  'food_and_dining',
  'shopping',
  'entertainment',
  'travel',
  'misc',
]);

export async function handleFinancialInsightsQuery(
  intent: InsightsIntent,
  entities: ExtractedEntities = {}
): Promise<CopilotResponse> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const monthStartDate = `${currentYear}-${currentMonthStr}-01`;

  const summary = await getFinancialSummary(monthStartDate);
  const categoryTotals = await getCategoryWiseTotals('expense', monthStartDate);
  const allTxs = await getAllTransactions({ startDate: monthStartDate });
  const expenseCount = allTxs.filter((t) => t.transaction_type === 'expense').length;

  const savings = summary.totalIncome - summary.totalExpenses;
  const savingsRate = summary.totalIncome > 0 ? (savings / summary.totalIncome) * 100 : 0;

  // Check data sufficiency
  if (summary.totalIncome === 0 && summary.totalExpenses === 0) {
    return {
      text: 'You have not recorded any income or expenses for this month yet. Your SQLite ledger is completely clean at ₹0.00.\n\nTo generate personalized spending insights and savings recommendations, start by recording your income and daily transactions.',
      intent,
      categoryGroup: 'INSIGHTS',
      suggestedPrompts: [
        'What is the 50/30/20 rule?',
        'How does an emergency fund work?',
        'What is SIP?',
      ],
    };
  }

  if (intent === 'WHERE_DOES_MONEY_GO' as any || intent === 'SPENDING_INSIGHTS' || intent === 'SPENDING_PATTERN_ANALYSIS') {
    if (categoryTotals.length === 0) {
      return {
        text: `You have recorded ₹0.00 in expenses this month. All of your recorded inflows (${formatINR(
          summary.totalIncome
        )}) remain unspent in your ledger.`,
        intent: 'SPENDING_INSIGHTS',
        categoryGroup: 'INSIGHTS',
      };
    }

    const topCategory = categoryTotals[0];
    const topThree = categoryTotals.slice(0, 3);
    const topThreeShare = topThree.reduce((sum, c) => sum + c.percentage, 0);

    const breakdownLines = topThree
      .map(
        (c, idx) =>
          `${idx + 1}. ${c.categoryName}: ${formatINR(c.totalAmount)} (${c.percentage.toFixed(1)}% of total spend)`
      )
      .join('\n');

    let insightText = `Based on your ${expenseCount} expense transactions this month totaling ${formatINR(
      summary.totalExpenses
    )}:\n\n${breakdownLines}\n\n`;

    if (topCategory.percentage >= 40) {
      insightText += `• Concentration Alert: Over ${topCategory.percentage.toFixed(
        0
      )}% of your monthly outflows are concentrated in "${topCategory.categoryName}". Reviewing recurring items here will have the highest impact.`;
    } else {
      insightText += `• Your top 3 categories account for ${topThreeShare.toFixed(
        0
      )}% of your total spending this month.`;
    }

    return {
      text: insightText,
      intent: 'SPENDING_INSIGHTS',
      categoryGroup: 'INSIGHTS',
      insight: {
        type: 'breakdown',
        title: `Primary Outflow: ${topCategory.categoryName}`,
        value: `${topCategory.percentage.toFixed(1)}% of Spend`,
        details: `${formatINR(topCategory.totalAmount)} across ${topCategory.transactionCount} entries`,
      },
      suggestedPrompts: [
        'How can I reduce my monthly expenses?',
        'Am I saving enough?',
        'Which category has the highest expenses?',
      ],
    };
  }

  if (intent === 'EXPENSE_REDUCTION' || intent === 'SAVINGS_RECOMMENDATIONS' || intent === 'SAVINGS_IMPROVEMENT') {
    // Identify discretionary spending
    const discretionaryTotals = categoryTotals.filter((c) =>
      DISCRETIONARY_CATEGORIES.has(c.categoryId)
    );
    const discretionarySum = discretionaryTotals.reduce((sum, c) => sum + c.totalAmount, 0);
    const discretionaryShare =
      summary.totalExpenses > 0 ? (discretionarySum / summary.totalExpenses) * 100 : 0;

    const topDiscretionary = discretionaryTotals.length > 0 ? discretionaryTotals[0] : null;

    let advice = '';
    if (topDiscretionary && topDiscretionary.totalAmount > 0) {
      advice = `1. Target Discretionary Categories: You spent ${formatINR(
        discretionarySum
      )} (${discretionaryShare.toFixed(
        0
      )}% of your outflows) on lifestyle categories. Trimming 15% from "${topDiscretionary.categoryName}" could recover approximately ${formatINR(
        topDiscretionary.totalAmount * 0.15
      )} per month.\n2. Apply the 48-Hour Rule: For non-essential shopping items above ₹2,000, wait 48 hours before purchasing to prevent impulse buys.\n3. Audit Recurring Subscriptions: Check for utility and app subscriptions you no longer actively use.`;
    } else {
      advice = `1. Track Daily Outflows: Maintain consistent records across all cash and UPI transactions.\n2. Set Category Guardrails: Define monthly budget limits in the Budgets tab to prevent category leakage.\n3. Implement the 50/30/20 Rule: Cap essential needs at 50% of your income.`;
    }

    // Try Gemma 3 1B explanation enhancement if model is loaded
    let responseText = `Personalized Recommendations to Reduce Expenses:\n\n• Current Monthly Outflow: ${formatINR(
      summary.totalExpenses
    )}\n• Current Net Savings: ${formatINR(savings)} (${savingsRate.toFixed(1)}% rate)\n\n${advice}`;

    const llamaStatus = LlamaService.getInstance().getModelStatus();
    if (llamaStatus.state === 'ready') {
      try {
        const prompt = formatGemma3Instruction(
          'You are a disciplined financial coach. Based strictly on the provided verified financial data, give 3 concise, practical tips to reduce expenses. Do not invent any numbers not present in the data. Keep currency in INR.',
          `Monthly Income: ${formatINR(summary.totalIncome)}\nMonthly Expenses: ${formatINR(
            summary.totalExpenses
          )}\nDiscretionary Spend: ${formatINR(discretionarySum)}\nTop Category: ${
            topDiscretionary ? topDiscretionary.categoryName : 'None'
          } (${topDiscretionary ? formatINR(topDiscretionary.totalAmount) : '₹0'})`
        );
        const generated = await LlamaService.getInstance().generateResponse(prompt, undefined, {
          maxTokens: 250,
          temperature: 0.1,
        });
        if (generated && generated.trim().length > 40) {
          responseText = `Personalized Expense Reduction Advice:\n\n${generated.trim()}\n\nVerified Ledger Status: Inflow ${formatINR(
            summary.totalIncome
          )} | Outflow ${formatINR(summary.totalExpenses)} | Net Savings ${formatINR(savings)}`;
        }
      } catch (err) {
        console.warn('[Insights] Gemma explanation error, using deterministic rules:', err);
      }
    }

    return {
      text: responseText,
      intent,
      categoryGroup: 'INSIGHTS',
      insight: {
        type: 'metric',
        title: 'Actionable Reduction',
        value: topDiscretionary ? topDiscretionary.categoryName : 'Budget Review',
        details: `Discretionary share: ${discretionaryShare.toFixed(0)}% (${formatINR(discretionarySum)})`,
      },
      suggestedPrompts: [
        'Am I saving enough?',
        'Where does most of my money go?',
        'What is the 50/30/20 rule?',
      ],
    };
  }

  // Fallback: AM_I_SAVING_ENOUGH
  let savingsEvaluation = '';
  if (summary.totalIncome === 0) {
    savingsEvaluation = 'No income records have been logged for this month yet. Log your salary or earnings to calculate your true savings rate.';
  } else if (savingsRate >= 30) {
    savingsEvaluation = `Superb! You are saving ${savingsRate.toFixed(
      1
    )}% of your income (${formatINR(savings)} saved from ${formatINR(
      summary.totalIncome
    )}). This puts you well ahead of standard financial benchmarks (20%). Consider directing your surplus into systematic mutual fund investments (SIP) or debt retirement.`;
  } else if (savingsRate >= 20) {
    savingsEvaluation = `Healthy! You are saving ${savingsRate.toFixed(
      1
    )}% of your income (${formatINR(savings)}). You are meeting the classical 20% savings rule. Next goal: Ensure your liquid emergency fund covers 3 to 6 months of expenses.`;
  } else if (savingsRate > 0) {
    savingsEvaluation = `Moderate. You are saving ${savingsRate.toFixed(
      1
    )}% of your income (${formatINR(
      savings
    )}), which is below the recommended 20% benchmark. Increasing your savings rate by just 5% would retain an additional ${formatINR(
      summary.totalIncome * 0.05
    )} each month.`;
  } else {
    savingsEvaluation = `⚠️ Critical: Your recorded expenses (${formatINR(
      summary.totalExpenses
    )}) exceed your recorded income (${formatINR(
      summary.totalIncome
    )}) by ${formatINR(Math.abs(savings))}. You are operating at a negative cashflow this month. Review your top spending categories to restore balance.`;
  }

  return {
    text: `Savings Health Assessment (${summary.totalIncome > 0 ? `${savingsRate.toFixed(1)}% Savings Rate` : 'No Income Logged'}):\n\n• Inflows: ${formatINR(
      summary.totalIncome
    )}\n• Outflows: ${formatINR(summary.totalExpenses)}\n• Net Savings: ${formatINR(
      savings
    )}\n\n${savingsEvaluation}`,
    intent: 'SAVINGS_RECOMMENDATIONS',
    categoryGroup: 'INSIGHTS',
    insight: {
      type: savingsRate >= 20 ? 'metric' : 'alert',
      title: 'Monthly Savings Rate',
      value: `${savingsRate.toFixed(1)}%`,
      details: `${formatINR(savings)} saved of ${formatINR(summary.totalIncome)} income`,
    },
    suggestedPrompts: [
      'How can I reduce my monthly expenses?',
      'Where does most of my money go?',
      'What is an emergency fund?',
    ],
  };
}

