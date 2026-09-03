import type { AnalyticsResult } from "../parser/types";

export function buildRecommendationsPrompt(analytics: AnalyticsResult): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a financial analyst reviewing a user's M-Pesa transaction data.
Generate 3-5 conservative, factual observations based on the data. These are NOT financial advice.
Rules:
- Never use "you should" or prescriptive language
- Only state observable facts and patterns
- Be specific with numbers
- Keep each observation to 1-2 sentences
- Focus on areas where the user might not realize the cumulative impact
- Never be judgmental about spending choices
- Format as a numbered list`;

  const subscriptionTotal = analytics.subscriptions.reduce((sum, s) => sum + s.monthlyCost, 0);
  const loanActivity = analytics.mobileLoanActivity;
  const categories = analytics.categoryBreakdown.slice(0, 5);

  const userPrompt = `Transaction analysis summary:
- Total outflows: KES ${analytics.totalOutflows.toLocaleString()}
- Total inflows: KES ${analytics.totalInflows.toLocaleString()}
- Transaction count: ${analytics.transactionCount}
- Top spending categories: ${categories.map((c) => `${c.category} (KES ${c.total.toLocaleString()}, ${c.percentage}%)`).join(", ")}
- Monthly subscriptions detected: ${analytics.subscriptions.length} totaling KES ${subscriptionTotal.toLocaleString()}/month
- Recurring payments: ${analytics.recurringPayments.length} detected
- Mobile loan activity: ${loanActivity.lenders.length} lenders, total borrowed KES ${loanActivity.totalBorrowed.toLocaleString()}, total fees KES ${loanActivity.totalFees.toLocaleString()}
- Late night transactions (10pm-4am): ${analytics.timePatterns.lateNightTransactions.count} totaling KES ${analytics.timePatterns.lateNightTransactions.total.toLocaleString()}

Generate factual observations about spending patterns, potential savings opportunities, and notable trends.`;

  return { systemPrompt, userPrompt };
}
