import {
  PersonalFinanceIntent,
  CopilotResponse,
  ExtractedEntities,
  DatePeriod,
} from './types';
import {
  getFinancialSummary,
  getCategoryWiseTotals,
  getAllTransactions,
} from '../../database';
import { formatINR } from '../../utils/currency';
import { CATEGORIES } from '../../data/mockData';

function getDateRangeForPeriod(
  period: DatePeriod = 'CURRENT_MONTH',
  customMonth?: number,
  customYear?: number
): { startDate?: string; endDate?: string; label: string } {
  const now = new Date();
  const currentYear = customYear || now.getFullYear();

  if (period === 'CURRENT_DAY') {
    const today = now.toISOString().split('T')[0];
    return { startDate: today, endDate: today, label: 'today' };
  }

  if (period === 'LAST_MONTH') {
    const lastMonthDate = new Date(currentYear, (customMonth !== undefined ? customMonth - 1 : now.getMonth()) - 1, 1);
    const y = lastMonthDate.getFullYear();
    const m = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
    const daysInLastMonth = new Date(y, lastMonthDate.getMonth() + 1, 0).getDate();
    return {
      startDate: `${y}-${m}-01`,
      endDate: `${y}-${m}-${String(daysInLastMonth).padStart(2, '0')}`,
      label: lastMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
    };
  }

  if (period === 'LIFETIME') {
    return { label: 'all time' };
  }

  // Default: CURRENT_MONTH
  const targetMonth = customMonth || now.getMonth() + 1;
  const mStr = String(targetMonth).padStart(2, '0');
  const daysInMonth = new Date(currentYear, targetMonth, 0).getDate();
  const monthName = new Date(currentYear, targetMonth - 1, 1).toLocaleString('default', {
    month: 'long',
  });

  return {
    startDate: `${currentYear}-${mStr}-01`,
    endDate: `${currentYear}-${mStr}-${String(daysInMonth).padStart(2, '0')}`,
    label: `${monthName} ${currentYear}`,
  };
}

export async function handlePersonalFinanceQuery(
  intent: PersonalFinanceIntent,
  entities: ExtractedEntities = {}
): Promise<CopilotResponse> {
  const period = entities.period || 'CURRENT_MONTH';
  const { startDate, endDate, label } = getDateRangeForPeriod(
    period,
    entities.targetMonth,
    entities.targetYear
  );

  switch (intent) {
    case 'TOTAL_BALANCE': {
      const summary = await getFinancialSummary();
      const txs = await getAllTransactions();
      const incomeCount = txs.filter((t) => t.transaction_type === 'income').length;
      const expenseCount = txs.filter((t) => t.transaction_type === 'expense').length;

      return {
        text: `Your current net balance in your offline SQLite ledger is ${formatINR(
          summary.netBalance
        )}.\n\n• Lifetime Income: ${formatINR(summary.totalIncome)} (${incomeCount} records)\n• Lifetime Expenses: ${formatINR(
          summary.totalExpenses
        )} (${expenseCount} records)`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'metric',
          title: 'Total Net Balance',
          value: formatINR(summary.netBalance),
          details: `${incomeCount} income / ${expenseCount} expense entries`,
        },
        suggestedPrompts: [
          'How much did I spend this month?',
          'What is my total income?',
          'Which category has the highest expenses?',
        ],
      };
    }

    case 'TOTAL_EXPENSES': {
      const summary = await getFinancialSummary(startDate, endDate);
      const txs = await getAllTransactions({
        type: 'expense',
        startDate,
        endDate,
      });
      const expenseCount = txs.length;

      return {
        text: `Your recorded expenses for ${label} are ${formatINR(
          summary.totalExpenses
        )} across ${expenseCount} expense ${expenseCount === 1 ? 'transaction' : 'transactions'}.`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'metric',
          title: `Total Outflow (${label})`,
          value: formatINR(summary.totalExpenses),
          details: `${expenseCount} expense records`,
        },
        suggestedPrompts: [
          'Which category has the highest expenses?',
          'Compare this month with last month',
          'What is my monthly budget status?',
        ],
      };
    }

    case 'TOTAL_INCOME': {
      const summary = await getFinancialSummary(startDate, endDate);
      const txs = await getAllTransactions({
        type: 'income',
        startDate,
        endDate,
      });
      const incomeCount = txs.length;

      return {
        text: `Your recorded income for ${label} is ${formatINR(
          summary.totalIncome
        )} across ${incomeCount} income ${incomeCount === 1 ? 'transaction' : 'transactions'}.`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'metric',
          title: `Total Inflow (${label})`,
          value: formatINR(summary.totalIncome),
          details: `${incomeCount} income records`,
        },
        suggestedPrompts: [
          'How much did I spend this month?',
          'What is my current balance?',
          'How can I improve my savings rate?',
        ],
      };
    }

    case 'MONTHLY_SUMMARY':
    case 'DAILY_SUMMARY': {
      const summary = await getFinancialSummary(startDate, endDate);
      const txs = await getAllTransactions({ startDate, endDate });
      const incomeCount = txs.filter((t) => t.transaction_type === 'income').length;
      const expenseCount = txs.filter((t) => t.transaction_type === 'expense').length;
      const savings = summary.totalIncome - summary.totalExpenses;
      const savingsRate =
        summary.totalIncome > 0 ? (savings / summary.totalIncome) * 100 : 0;

      return {
        text: `Financial Summary for ${label}:\n\n• Inflow: ${formatINR(
          summary.totalIncome
        )} (${incomeCount} income entries)\n• Outflow: ${formatINR(
          summary.totalExpenses
        )} (${expenseCount} expense entries)\n• Net Savings: ${formatINR(
          savings
        )} (${savingsRate.toFixed(1)}% savings rate)`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'metric',
          title: `Summary · ${label}`,
          value: `${formatINR(savings)} Net`,
          details: `Inflow: ${formatINR(summary.totalIncome)} | Outflow: ${formatINR(
            summary.totalExpenses
          )}`,
        },
        suggestedPrompts: [
          'Which category has the highest expenses?',
          'What is my monthly budget status?',
          'Where does most of my money go?',
        ],
      };
    }

    case 'SAVINGS':
    case 'SAVINGS_RATE': {
      const summary = await getFinancialSummary(startDate, endDate);
      const savings = summary.totalIncome - summary.totalExpenses;
      const savingsRate =
        summary.totalIncome > 0 ? (savings / summary.totalIncome) * 100 : 0;

      let assessment = 'You have not recorded any income yet this period.';
      if (summary.totalIncome > 0) {
        if (savingsRate >= 30) {
          assessment = 'Excellent! Your savings rate exceeds the benchmark 20% rule.';
        } else if (savingsRate >= 20) {
          assessment = 'Good! You are meeting the standard 20% savings target.';
        } else if (savingsRate > 0) {
          assessment = 'You are generating positive savings, but below the ideal 20% target.';
        } else {
          assessment = 'Caution: Your recorded outflows exceed your inflows for this period.';
        }
      }

      return {
        text: `Net Savings for ${label}:\n\n• Net Amount: ${formatINR(
          savings
        )}\n• Savings Rate: ${savingsRate.toFixed(
          1
        )}%\n• Total Income: ${formatINR(summary.totalIncome)}\n• Total Expenses: ${formatINR(
          summary.totalExpenses
        )}\n\n${assessment}`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'metric',
          title: `Savings Rate · ${label}`,
          value: `${savingsRate.toFixed(1)}%`,
          details: `${formatINR(savings)} saved from ${formatINR(summary.totalIncome)}`,
        },
        suggestedPrompts: [
          'How can I improve my savings rate?',
          'Where does most of my money go?',
          'What is the 50/30/20 rule?',
        ],
      };
    }

    case 'CATEGORY_EXPENSES': {
      const categoryTotals = await getCategoryWiseTotals('expense', startDate, endDate);
      const targetQuery = (entities.category || entities.categoryName || '').toLowerCase().trim();

      const matched = categoryTotals.find((c) => {
        const idMatch = c.categoryId.toLowerCase().includes(targetQuery);
        const nameMatch = c.categoryName.toLowerCase().includes(targetQuery);
        return idMatch || nameMatch;
      });

      if (matched) {
        return {
          text: `You spent ${formatINR(matched.totalAmount)} on ${matched.categoryName} during ${label}.\n\nThis represents ${matched.percentage.toFixed(
            1
          )}% of your recorded outflows across ${matched.transactionCount} ${
            matched.transactionCount === 1 ? 'transaction' : 'transactions'
          }.`,
          intent,
          categoryGroup: 'PERSONAL_FINANCE',
          insight: {
            type: 'breakdown',
            title: matched.categoryName,
            value: formatINR(matched.totalAmount),
            details: `${matched.percentage.toFixed(1)}% of expenses (${matched.transactionCount} records)`,
          },
          suggestedPrompts: [
            'What about last month?',
            'Which category has the highest expenses?',
            'What is my grocery budget?',
          ],
        };
      }

      // Check if the category exists in standard definitions
      const knownCat = Object.values(CATEGORIES).find(
        (c) =>
          c.id.toLowerCase().includes(targetQuery) ||
          c.name.toLowerCase().includes(targetQuery)
      );
      const catDisplayName = knownCat ? knownCat.name : entities.categoryName || targetQuery || 'this category';

      return {
        text: `You have ₹0.00 in recorded expenses for ${catDisplayName} in ${label} across 0 transactions.`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'metric',
          title: catDisplayName,
          value: '₹0.00',
          details: `0 expenses found in ${label}`,
        },
        suggestedPrompts: [
          'Which category has the highest expenses?',
          'How much did I spend this month?',
          'What is my monthly budget status?',
        ],
      };
    }

    case 'HIGHEST_SPENDING_CATEGORY': {
      const categoryTotals = await getCategoryWiseTotals('expense', startDate, endDate);
      const rank = entities.rank || 1;
      const targetIndex = rank - 1;

      if (categoryTotals.length === 0) {
        return {
          text: `No expense records found for ${label} in your SQLite database. Total recorded expenses are ₹0.00 across 0 transactions.`,
          intent,
          categoryGroup: 'PERSONAL_FINANCE',
          suggestedPrompts: [
            'What is my total income?',
            'What is my current balance?',
            'What is the 50/30/20 rule?',
          ],
        };
      }

      if (targetIndex >= categoryTotals.length) {
        const top = categoryTotals[0];
        return {
          text: `You have recorded expenses in ${categoryTotals.length} category. Your primary spending category is ${top.categoryName} with ${formatINR(
            top.totalAmount
          )} (${top.percentage.toFixed(1)}% of expenses).`,
          intent,
          categoryGroup: 'PERSONAL_FINANCE',
        };
      }

      const item = categoryTotals[targetIndex];
      const rankText = rank === 1 ? 'highest-spending' : rank === 2 ? 'second highest-spending' : `${rank}th highest`;

      return {
        text: `Your ${rankText} category for ${label} is ${item.categoryName} with ${formatINR(
          item.totalAmount
        )} (${item.percentage.toFixed(1)}% of your total outflows across ${item.transactionCount} transactions).`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'breakdown',
          title: `${rank === 1 ? 'Top' : `#${rank}`} Outflow: ${item.categoryName}`,
          value: formatINR(item.totalAmount),
          details: `${item.percentage.toFixed(1)}% of total (${item.transactionCount} records)`,
        },
        suggestedPrompts: [
          'Which category is next highest?',
          'Where does most of my money go?',
          'How can I reduce my expenses?',
        ],
      };
    }

    case 'HIGHEST_EXPENSE': {
      const txs = await getAllTransactions({
        type: 'expense',
        startDate,
        endDate,
        sortBy: 'amount',
        sortOrder: 'DESC',
        limit: 1,
      });

      if (txs.length === 0) {
        return {
          text: `No expense transactions found for ${label}.`,
          intent,
          categoryGroup: 'PERSONAL_FINANCE',
        };
      }

      const top = txs[0];
      const catMeta = (CATEGORIES as Record<string, any>)[top.category];
      const catName = catMeta ? catMeta.name : top.category;

      return {
        text: `Your single highest recorded expense in ${label} is ${formatINR(
          top.amount
        )} for "${top.description}"${top.merchant ? ` at ${top.merchant}` : ''} on ${top.transaction_date} (${catName}).`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'metric',
          title: 'Single Largest Outflow',
          value: formatINR(top.amount),
          details: `${top.description} on ${top.transaction_date}`,
        },
      };
    }

    case 'RECENT_TRANSACTIONS': {
      const txs = await getAllTransactions({ limit: 5 });
      if (txs.length === 0) {
        return {
          text: 'No transactions recorded yet in your local database. All accounts start clean at ₹0.00.',
          intent,
          categoryGroup: 'PERSONAL_FINANCE',
        };
      }

      const lines = txs.map((t, idx) => {
        const sign = t.transaction_type === 'income' ? '+' : '-';
        return `${idx + 1}. ${t.transaction_date} · ${sign}${formatINR(t.amount)} · ${t.description}${
          t.merchant ? ` (${t.merchant})` : ''
        }`;
      });

      return {
        text: `Here are your 5 most recent ledger transactions:\n\n${lines.join('\n')}`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'metric',
          title: 'Recent Activity',
          value: `${txs.length} Transactions`,
          details: `Latest on ${txs[0].transaction_date}`,
        },
      };
    }

    case 'MONTHLY_COMPARISON': {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const thisMonthRange = getDateRangeForPeriod('CURRENT_MONTH');
      const lastMonthRange = getDateRangeForPeriod('LAST_MONTH');

      const thisSummary = await getFinancialSummary(thisMonthRange.startDate, thisMonthRange.endDate);
      const lastSummary = await getFinancialSummary(lastMonthRange.startDate, lastMonthRange.endDate);

      const expenseDelta = thisSummary.totalExpenses - lastSummary.totalExpenses;
      const incomeDelta = thisSummary.totalIncome - lastSummary.totalIncome;

      const expenseChangeText =
        lastSummary.totalExpenses > 0
          ? `${expenseDelta >= 0 ? '+' : ''}${formatINR(expenseDelta)} (${((expenseDelta / lastSummary.totalExpenses) * 100).toFixed(1)}%)`
          : 'First tracked month with expenses';

      return {
        text: `Comparison (${thisMonthRange.label} vs ${lastMonthRange.label}):\n\n• Current Month Expenses: ${formatINR(
          thisSummary.totalExpenses
        )}\n• Previous Month Expenses: ${formatINR(
          lastSummary.totalExpenses
        )}\n• Outflow Change: ${expenseChangeText}\n\n• Current Month Income: ${formatINR(
          thisSummary.totalIncome
        )}\n• Previous Month Income: ${formatINR(lastSummary.totalIncome)}`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
        insight: {
          type: 'metric',
          title: 'Month-over-Month Outflow',
          value: expenseDelta <= 0 ? `Reduced by ${formatINR(Math.abs(expenseDelta))}` : `Increased by ${formatINR(expenseDelta)}`,
          details: `${thisMonthRange.label} vs ${lastMonthRange.label}`,
        },
      };
    }

    case 'TRANSACTION_SEARCH': {
      const q = entities.searchQuery || entities.merchant || entities.description || '';
      if (!q.trim()) {
        return {
          text: 'Please specify a merchant, keyword, or description to search for.',
          intent,
          categoryGroup: 'PERSONAL_FINANCE',
        };
      }

      const results = await getAllTransactions({ searchQuery: q.trim(), limit: 5 });
      if (results.length === 0) {
        return {
          text: `No transactions found matching "${q}" in your local SQLite records.`,
          intent,
          categoryGroup: 'PERSONAL_FINANCE',
        };
      }

      const lines = results.map(
        (t, idx) =>
          `${idx + 1}. ${t.transaction_date} · ${t.transaction_type === 'income' ? '+' : '-'}${formatINR(t.amount)} · ${t.description}${
            t.merchant ? ` (${t.merchant})` : ''
          }`
      );

      return {
        text: `Found ${results.length} transaction${results.length === 1 ? '' : 's'} matching "${q}":\n\n${lines.join('\n')}`,
        intent,
        categoryGroup: 'PERSONAL_FINANCE',
      };
    }

    default: {
      const summary = await getFinancialSummary();
      return {
        text: `Your current net balance in SQLite is ${formatINR(summary.netBalance)} with lifetime income of ${formatINR(
          summary.totalIncome
        )} and expenses of ${formatINR(summary.totalExpenses)}.`,
        intent: 'TOTAL_BALANCE',
        categoryGroup: 'PERSONAL_FINANCE',
      };
    }
  }
}

