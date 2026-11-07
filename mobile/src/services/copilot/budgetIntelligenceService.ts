import { BudgetIntent, CopilotResponse, ExtractedEntities } from './types';
import { getBudgetProgress, budgetRepository } from '../../database';
import { formatINR } from '../../utils/currency';
import { CATEGORIES } from '../../data/mockData';

export async function handleBudgetQuery(
  intent: BudgetIntent,
  entities: ExtractedEntities = {}
): Promise<CopilotResponse> {
  const now = new Date();
  const currentMonth = entities.targetMonth || now.getMonth() + 1;
  const currentYear = entities.targetYear || now.getFullYear();
  const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleString('default', {
    month: 'long',
  });

  const budgets = await getBudgetProgress(currentMonth, currentYear);
  const totalLimit = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
  const remaining = Math.max(totalLimit - totalSpent, 0);
  const overallRatio = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const isOverallExceeded = totalSpent > totalLimit && totalLimit > 0;

  const overspentBudgets = budgets.filter((b) => b.isOverBudget);
  const warningBudgets = budgets.filter((b) => !b.isOverBudget && b.percentage >= 80);

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysRemaining = Math.max(daysInMonth - now.getDate(), 0);

  switch (intent) {
    case 'CATEGORY_BUDGET': {
      const targetQuery = (entities.category || entities.categoryName || '').toLowerCase().trim();

      if (!targetQuery) {
        // Fallback to total budget overview if no specific category was mentioned
        return handleBudgetQuery('TOTAL_BUDGET', entities);
      }

      const matched = budgets.find(
        (b) =>
          b.categoryId.toLowerCase().includes(targetQuery) ||
          b.categoryName.toLowerCase().includes(targetQuery)
      );

      if (matched) {
        const statusText = matched.isOverBudget
          ? `⚠️ Over budget by ${formatINR(Math.abs(matched.remainingAmount))}`
          : matched.percentage >= 80
          ? `⚠️ Approaching limit (${matched.percentage.toFixed(1)}% spent)`
          : `✅ On track (${matched.percentage.toFixed(1)}% spent)`;

        return {
          text: `Budget for ${matched.categoryName} (${monthName} ${currentYear}):\n\n• Limit: ${formatINR(
            matched.monthlyLimit
          )}\n• Spent: ${formatINR(matched.spentAmount)}\n• Remaining: ${formatINR(
            matched.remainingAmount
          )}\n• Utilization: ${matched.percentage.toFixed(1)}%\n\nStatus: ${statusText}`,
          intent,
          categoryGroup: 'BUDGET',
          insight: {
            type: matched.isOverBudget ? 'alert' : 'metric',
            title: `${matched.categoryName} Budget`,
            value: matched.isOverBudget ? 'Over Budget' : `${formatINR(matched.remainingAmount)} Left`,
            details: `${formatINR(matched.spentAmount)} spent of ${formatINR(matched.monthlyLimit)}`,
          },
          suggestedPrompts: [
            'How much budget do I have left?',
            'Which category is closest to its budget limit?',
            'Am I overspending?',
          ],
        };
      }

      // Check if this category exists in system but has no budget set
      const known = Object.values(CATEGORIES).find(
        (c) =>
          c.id.toLowerCase().includes(targetQuery) ||
          c.name.toLowerCase().includes(targetQuery)
      );
      const catDisplayName = known ? known.name : targetQuery;

      return {
        text: `No budget limit is currently configured for ${catDisplayName} for ${monthName} ${currentYear}.\n\nAll category budgets start at ₹0.00 until set. You can configure a limit from the Budgets tab.`,
        intent,
        categoryGroup: 'BUDGET',
        suggestedPrompts: [
          'What is my monthly budget status?',
          'How much can I safely spend?',
          'Which category has the highest expenses?',
        ],
      };
    }

    case 'OVER_BUDGET_CATEGORY':
    case 'BUDGET_WARNING': {
      if (budgets.length === 0) {
        return {
          text: `You have not configured any category budgets for ${monthName} ${currentYear}.\n\nAll categories start at ₹0.00 limit. Tap "Set Limit" in the Budgets tab to establish guardrails.`,
          intent,
          categoryGroup: 'BUDGET',
        };
      }

      if (overspentBudgets.length > 0) {
        const list = overspentBudgets
          .map(
            (b) =>
              `• ${b.categoryName}: Spent ${formatINR(b.spentAmount)} (Limit: ${formatINR(
                b.monthlyLimit
              )} — Exceeded by ${formatINR(Math.abs(b.remainingAmount))})`
          )
          .join('\n');

        return {
          text: `⚠️ Over-Budget Alert for ${monthName} ${currentYear}:\n\nYou have exceeded your limit in ${overspentBudgets.length} ${
            overspentBudgets.length === 1 ? 'category' : 'categories'
          }:\n\n${list}`,
          intent,
          categoryGroup: 'BUDGET',
          insight: {
            type: 'alert',
            title: 'Over-Budget Alert',
            value: `${overspentBudgets.length} Exceeded`,
            details: overspentBudgets.map((b) => b.categoryName).join(', '),
          },
          suggestedPrompts: [
            'How can I reduce my expenses?',
            'What is my safe-to-spend amount?',
            'Where does most of my money go?',
          ],
        };
      }

      if (warningBudgets.length > 0) {
        const list = warningBudgets
          .map(
            (b) =>
              `• ${b.categoryName}: ${b.percentage.toFixed(1)}% utilized (${formatINR(
                b.remainingAmount
              )} remaining of ${formatINR(b.monthlyLimit)})`
          )
          .join('\n');

        return {
          text: `⚠️ Near-Limit Warning (>80% spent) for ${monthName} ${currentYear}:\n\n${list}\n\nYou have ${daysRemaining} days remaining in this month.`,
          intent,
          categoryGroup: 'BUDGET',
          insight: {
            type: 'alert',
            title: 'Near Budget Limit',
            value: `${warningBudgets.length} Warning`,
            details: warningBudgets.map((b) => `${b.categoryName} (${b.percentage.toFixed(0)}%)`).join(', '),
          },
          suggestedPrompts: [
            'How much can I safely spend?',
            'How much did I spend this month?',
            'How can I reduce my expenses?',
          ],
        };
      }

      return {
        text: `✅ Great job! None of your ${budgets.length} configured budgets are currently over limit or above 80% utilization for ${monthName} ${currentYear}. Total safe to spend: ${formatINR(
          remaining
        )}.`,
        intent,
        categoryGroup: 'BUDGET',
        insight: {
          type: 'metric',
          title: 'Budgets On Track',
          value: '100% Compliant',
          details: `${budgets.length} active categories`,
        },
      };
    }

    case 'SAFE_TO_SPEND':
    case 'BUDGET_REMAINING': {
      if (budgets.length === 0) {
        return {
          text: `You have not set any spending budgets for ${monthName} ${currentYear}.\n\nTo compute safe-to-spend guardrails, set monthly limits in the Budgets tab.`,
          intent,
          categoryGroup: 'BUDGET',
        };
      }

      const dailyAllowance = daysRemaining > 0 ? remaining / daysRemaining : remaining;

      return {
        text: `Safe to Spend for ${monthName} ${currentYear}:\n\n• Remaining Allowance: ${formatINR(
          remaining
        )}\n• Total Budget: ${formatINR(totalLimit)}\n• Total Spent: ${formatINR(
          totalSpent
        )}\n• Days Remaining: ${daysRemaining} days\n• Suggested Daily Pace: ${formatINR(
          dailyAllowance
        )}/day`,
        intent,
        categoryGroup: 'BUDGET',
        insight: {
          type: 'metric',
          title: 'Safe to Spend',
          value: formatINR(remaining),
          details: `${formatINR(dailyAllowance)}/day for ${daysRemaining} days`,
        },
        suggestedPrompts: [
          'Which category is closest to its budget limit?',
          'Am I overspending?',
          'How much did I spend this month?',
        ],
      };
    }

    case 'TOTAL_BUDGET':
    case 'BUDGET_UTILIZATION':
    default: {
      if (budgets.length === 0) {
        return {
          text: `No category budgets configured for ${monthName} ${currentYear}. All category limits start at ₹0.00.\n\nTap "Set Limit" in the Budgets tab to configure monthly spending guardrails.`,
          intent: 'TOTAL_BUDGET',
          categoryGroup: 'BUDGET',
          suggestedPrompts: [
            'What is my total expenses this month?',
            'What is the 50/30/20 rule?',
            'What is my current balance?',
          ],
        };
      }

      return {
        text: `Monthly Budget Status (${monthName} ${currentYear}):\n\n• Total Budget: ${formatINR(
          totalLimit
        )}\n• Total Spent: ${formatINR(totalSpent)}\n• Safe to Spend: ${formatINR(
          remaining
        )}\n• Overall Utilization: ${overallRatio.toFixed(1)}%\n• Active Budgets: ${
          budgets.length
        } categories\n\n${
          isOverallExceeded
            ? `⚠️ Total spending has exceeded your aggregated budget by ${formatINR(
                totalSpent - totalLimit
              )}.`
            : `✅ Spending is within overall limits. You have ${daysRemaining} days left in the month.`
        }`,
        intent: 'TOTAL_BUDGET',
        categoryGroup: 'BUDGET',
        insight: {
          type: isOverallExceeded ? 'alert' : 'metric',
          title: 'Budget Utilization',
          value: `${overallRatio.toFixed(1)}%`,
          details: `${formatINR(totalSpent)} spent of ${formatINR(totalLimit)} limit`,
        },
        suggestedPrompts: [
          'Which category is closest to its budget limit?',
          'Am I overspending?',
          'How much can I safely spend?',
        ],
      };
    }
  }
}

