import { GeneralKnowledgeIntent, CopilotResponse } from './types';
import { LlamaService, formatGemma3Instruction } from '../llamaService';

interface KnowledgeTopic {
  title: string;
  summary: string;
  explanation: string;
  example: string;
  disclaimer?: string;
  suggestedPrompts: string[];
}

const FINANCIAL_KNOWLEDGE_BASE: Record<GeneralKnowledgeIntent, KnowledgeTopic> = {
  SIP_EXPLANATION: {
    title: 'Systematic Investment Plan (SIP)',
    summary: 'A disciplined way to invest a fixed amount regularly into mutual funds.',
    explanation:
      'A Systematic Investment Plan (SIP) allows you to invest a predetermined amount periodically (usually monthly) into a chosen mutual fund scheme. SIP enforces financial discipline, utilizes Rupee Cost Averaging (buying more units when prices fall and fewer when prices rise), and harnesses the power of compounding without requiring you to time the stock market.',
    example:
      'Example: Investing ₹5,000 every month for 10 years. At an assumed annualized return of 12%, an aggregate investment of ₹6,00,000 can grow to approximately ₹11,61,695 through disciplined monthly compounding.',
    disclaimer:
      'Disclaimer: Mutual fund investments are subject to market risks. Read all scheme-related documents carefully. Returns are not guaranteed.',
    suggestedPrompts: [
      'What is a mutual fund?',
      'Explain compound interest',
      'What is the 50/30/20 rule?',
    ],
  },
  MUTUAL_FUNDS: {
    title: 'Mutual Funds',
    summary: 'A pooled investment vehicle managed by professional fund managers.',
    explanation:
      'A mutual fund pools money from multiple investors to purchase a diversified portfolio of equities, debt instruments, gold, or money market securities. Professional fund managers allocate and rebalance the portfolio according to the scheme objective (Equity, Debt, or Hybrid). Investors hold fractional units proportional to their contribution.',
    example:
      'Example: If you invest ₹10,000 in an Equity Index Fund with a Net Asset Value (NAV) of ₹50 per unit, you receive 200 fund units. As the underlying stock prices fluctuate, your NAV adjusts accordingly.',
    disclaimer:
      'Disclaimer: Mutual fund units fluctuate with market conditions. Historical performance does not guarantee future results.',
    suggestedPrompts: [
      'What is SIP?',
      'What is diversification?',
      'How does an emergency fund work?',
    ],
  },
  COMPOUND_INTEREST: {
    title: 'Compound Interest',
    summary: 'Earning interest on both your initial principal and previously accumulated interest.',
    explanation:
      'Compound interest is often called the "snowball effect" of finance. Unlike simple interest which only earns on the original principal, compound interest reinvests your earnings so that each future period generates interest on a progressively larger capital base over time.',
    example:
      'Example: If you invest ₹1,00,000 at 10% annual compound interest:\n• Year 1: ₹1,00,000 earns ₹10,000 → Total ₹1,10,000\n• Year 2: ₹1,10,000 earns ₹11,000 → Total ₹1,21,000\n• Year 10: Your original ₹1,00,000 grows to ₹2,59,374 without adding any extra deposits.',
    suggestedPrompts: [
      'What is SIP?',
      'What is inflation?',
      'Explain the 50/30/20 rule',
    ],
  },
  INFLATION: {
    title: 'Inflation & Purchasing Power',
    summary: 'The gradual increase in prices that erodes purchasing power over time.',
    explanation:
      'Inflation represents the rate at which the general level of prices for goods and services rises in an economy. When inflation occurs, every Rupee buys a smaller percentage of goods and services than it did previously. To preserve and grow wealth, your investment portfolio must generate post-tax returns that exceed the prevailing inflation rate.',
    example:
      'Example: At an average inflation rate of 6% in India, a basket of monthly groceries costing ₹10,000 today will cost approximately ₹17,908 in 10 years for the exact same quantity of goods.',
    suggestedPrompts: [
      'Explain compound interest',
      'What is an emergency fund?',
      'What is diversification?',
    ],
  },
  EMERGENCY_FUND: {
    title: 'Emergency Fund',
    summary: 'A liquid safety buffer covering 3 to 6 months of mandatory living expenses.',
    explanation:
      'An emergency fund is a dedicated financial safety cushion stored in highly liquid, capital-safe instruments (such as a high-yield savings account or overnight/liquid mutual fund). Its primary purpose is to safeguard you against unforeseen shocks—such as sudden medical emergencies, job loss, or essential repairs—without forcing you into high-interest debt or distress-selling your long-term investments.',
    example:
      'Example: If your fixed monthly obligations (rent, EMIs, utilities, groceries) total ₹35,000, your target emergency fund should be between ₹1,05,000 (3 months) and ₹2,10,000 (6 months).',
    suggestedPrompts: [
      'What is the 50/30/20 rule?',
      'What is SIP?',
      'What is a credit score?',
    ],
  },
  CREDIT_SCORE: {
    title: 'Credit Score (CIBIL / Experian)',
    summary: 'A numerical measure (300-900) of your creditworthiness and borrowing history.',
    explanation:
      'In India, your credit score is computed by bureaus like CIBIL, Experian, and Equifax based on your loan and credit card repayment history. A score of 750 or higher is considered excellent. It unlocks lower interest rates on home/car loans, higher credit limits, and faster loan approvals.',
    example:
      'Example: Paying your credit card balance in full before the due date and maintaining credit utilization below 30% helps keep your score above 750.',
    suggestedPrompts: [
      'What is an asset vs liability?',
      'What is an emergency fund?',
      'Explain the 50/30/20 rule',
    ],
  },
  ASSET_LIABILITY: {
    title: 'Assets vs. Liabilities',
    summary: 'Assets put money in your pocket; liabilities take money out.',
    explanation:
      'An asset is an economic resource that generates income or appreciates in value over time (such as mutual funds, sovereign gold bonds, productive real estate, or fixed deposits). A liability is a financial debt or financial obligation that drains cash flow through interest payments, maintenance, or depreciation (such as credit card balances, personal loans, or high-depreciation vehicles).',
    example:
      'Example: A rental property generating ₹25,000 monthly income after mortgage payments is an asset. A car bought on a 5-year personal loan that costs ₹18,000 in monthly EMI, fuel, and depreciation is a liability.',
    suggestedPrompts: [
      'What is diversification?',
      'Explain compound interest',
      'What is SIP?',
    ],
  },
  DIVERSIFICATION: {
    title: 'Portfolio Diversification',
    summary: 'Spreading investments across uncorrelated asset classes to minimize risk.',
    explanation:
      'Diversification is the risk management strategy of allocating investments across distinct asset classes (Equities, Debt/Fixed Income, Gold, Real Estate) and sectors. The goal is to smooth out overall portfolio volatility, because different asset classes rarely move in the exact same direction at the same time.',
    example:
      'Example: During a stock market downturn where equities drop 15%, gold and debt instruments may remain stable or appreciate, softening the total portfolio impact.',
    disclaimer:
      'Disclaimer: Diversification reduces risk but does not guarantee against capital losses in broad market downturns.',
    suggestedPrompts: [
      'What is a mutual fund?',
      'What is SIP?',
      'What is stock market basics?',
    ],
  },
  STOCK_MARKET_BASICS: {
    title: 'Stock Market Basics',
    summary: 'A public marketplace for buying and selling equity shares of listed companies.',
    explanation:
      'The stock market (such as NSE and BSE in India) enables businesses to raise capital by issuing shares to the public. As an investor, purchasing a share makes you a part-owner of that enterprise. Returns are realized through stock price appreciation as the company grows, as well as periodic dividend payouts.',
    example:
      'Example: Buying 10 shares of an Indian enterprise at ₹1,000 per share. If the company expands its earnings and the share rises to ₹1,200, your portfolio gains ₹2,000 (20% capital gain) plus any distributed dividends.',
    disclaimer:
      'Disclaimer: Equities carry market volatility risk. Invest with a multi-year horizon and sound fundamentals.',
    suggestedPrompts: [
      'What is a mutual fund?',
      'What is diversification?',
      'Explain compound interest',
    ],
  },
  BUDGETING_EDUCATION: {
    title: 'The 50/30/20 Budgeting Rule',
    summary: 'A classic, straightforward framework to allocate net take-home income.',
    explanation:
      'The 50/30/20 rule divides your net monthly income into three simple buckets:\n• 50% for Needs: Mandatory living costs (rent, groceries, utilities, transit, EMIs)\n• 30% for Wants: Discretionary lifestyle spending (dining out, entertainment, vacations)\n• 20% for Savings & Debt: Emergency fund, SIP investments, retirement, and accelerated debt payoff.',
    example:
      'Example: On a net monthly salary of ₹60,000:\n• Needs (50%): ₹30,000\n• Wants (30%): ₹18,000\n• Savings (20%): ₹12,000',
    suggestedPrompts: [
      'What is an emergency fund?',
      'How can I reduce my expenses?',
      'What is SIP?',
    ],
  },
  INVESTMENT_BASICS: {
    title: 'Investment Fundamentals',
    summary: 'Core principles: time horizon, risk profile, inflation beating, and consistency.',
    explanation:
      'Investing is the act of putting money to work in assets with the expectation of generating capital growth or recurring income over time. Key principles include:\n1. Match the asset class to your timeline (Short-term: Liquid/FD, Long-term: Equity/SIP)\n2. Understand your risk tolerance\n3. Beat inflation consistently\n4. Rebalance your asset allocation periodically.',
    example:
      'Example: For goals within 1-2 years, preserve capital in Fixed Deposits or Liquid Funds. For goals 7+ years away (e.g. retirement), allocate predominantly to diversified equity funds.',
    disclaimer:
      'Disclaimer: Capital allocation should align with individual financial risk profile and time horizon.',
    suggestedPrompts: [
      'What is SIP?',
      'Explain compound interest',
      'What is diversification?',
    ],
  },
  GENERAL_FINANCIAL_QUESTION: {
    title: 'Financial Knowledge & Best Practices',
    summary: 'Essential financial rules of thumb for long-term financial independence.',
    explanation:
      'Healthy financial management rests on four pillars:\n1. Maintain a balanced budget where expenses remain strictly lower than income.\n2. Build a 3-6 month emergency fund before aggressive market investing.\n3. Protect against catastrophic risks with adequate term life and health insurance.\n4. Invest consistently every month through index/mutual funds to compound wealth.',
    example:
      'Example: Automating your monthly savings on salary day ("Pay Yourself First") ensures you invest before discretionary expenses occur.',
    suggestedPrompts: [
      'What is SIP?',
      'Explain compound interest',
      'What is the 50/30/20 rule?',
    ],
  },
};

/**
 * Handles all General Financial Knowledge queries without querying personal SQLite data.
 * When the local Gemma 3 1B model is initialized and ready, it enhances the explanation.
 */
export async function handleGeneralKnowledgeQuery(
  intent: GeneralKnowledgeIntent,
  userQuery: string
): Promise<CopilotResponse> {
  const topic = FINANCIAL_KNOWLEDGE_BASE[intent] || FINANCIAL_KNOWLEDGE_BASE.GENERAL_FINANCIAL_QUESTION;

  // Check if Gemma 3 1B model is loaded and ready for natural language generation
  const llamaStatus = LlamaService.getInstance().getModelStatus();

  let explanationText = `${topic.title}\n\n${topic.explanation}\n\n${topic.example}`;
  if (topic.disclaimer) {
    explanationText += `\n\n${topic.disclaimer}`;
  }

  if (llamaStatus.state === 'ready') {
    try {
      const prompt = formatGemma3Instruction(
        'You are an expert financial educator. Explain the following concept clearly in simple language, with an example in Indian Rupees (₹). Do not query personal balance or user data. Be concise, objective, and include a brief market risk disclaimer if investment-related.',
        `Topic: ${topic.title}\nUser Question: ${userQuery}`
      );

      const generated = await LlamaService.getInstance().generateResponse(
        prompt,
        undefined,
        {
          maxTokens: 300,
          temperature: 0.2,
          topP: 0.9,
        }
      );

      if (generated && generated.trim().length > 30) {
        explanationText = generated.trim();
      }
    } catch (modelErr) {
      console.warn('[GeneralKnowledge] Gemma generation error, using curated offline knowledge:', modelErr);
    }
  }

  return {
    text: explanationText,
    intent,
    categoryGroup: 'GENERAL_KNOWLEDGE',
    insight: {
      type: 'metric',
      title: topic.title,
      value: 'Financial Education',
      details: topic.summary,
    },
    suggestedPrompts: topic.suggestedPrompts,
  };
}

