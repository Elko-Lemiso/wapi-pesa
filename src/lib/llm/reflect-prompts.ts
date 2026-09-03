import type { AnalyticsResult } from "../parser/types";

export function buildReflectCopyPrompt(analytics: AnalyticsResult): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a witty copywriter creating Wapi Pesa Reflect cards — like Spotify Wrapped but for mobile money.
Tone: meme-fluent, Sheng-aware where it lands naturally, but NEVER mean. Tease like a friend, never roast like an enemy.
NEVER shame spending, borrowing, or financial choices. No Fuliza-shaming. No broke jokes. Nothing classist.
Keep it playful, specific to the data, and genuinely fun to screenshot and share.
The input deliberately uses generic recipient labels. Do not invent names, phone numbers, or identities.

You'll write copy for each card in the set. Each card should:
- Have a headline (bold, punchy, one line)
- Have 1-2 lines of body copy (observational, funny)
- Be specific to the actual numbers provided
- Feel like something you'd see on a friend's Instagram story

Output format — return a JSON array of objects with fields: cardType, headline, body
Card types: headline, topPaybill, topPerson, restaurants, lateNights, subscriptions, transport, sendMoney, punchline, stats`;

  const top5Categories = analytics.categoryBreakdown.slice(0, 5);
  const topByAmount = analytics.topCounterpartiesByAmount.slice(0, 5);
  const topByFreq = analytics.topCounterpartiesByFrequency.slice(0, 5);
  const personSends = analytics.personToPersonSends.slice(0, 5);

  const userPrompt = `Here's the user's M-Pesa year in numbers:

TOTALS:
- Total money moved: KES ${(analytics.totalInflows + analytics.totalOutflows).toLocaleString()}
- Total spent: KES ${analytics.totalOutflows.toLocaleString()}
- Total received: KES ${analytics.totalInflows.toLocaleString()}
- Transactions: ${analytics.transactionCount}

TOP SPENDING CATEGORIES:
${top5Categories.map((c) => `- ${c.category}: KES ${c.total.toLocaleString()} (${c.percentage}%)`).join("\n")}

TOP RECIPIENTS BY AMOUNT:
${topByAmount.map((c, i) => `- Recipient ${i + 1} (${c.category || "uncategorized"}): KES ${c.totalAmount.toLocaleString()} (${c.frequency} times)`).join("\n")}

MOST FREQUENT:
${topByFreq.map((c, i) => `- Recipient ${i + 1} (${c.category || "uncategorized"}): ${c.frequency} times, KES ${c.totalAmount.toLocaleString()}`).join("\n")}

TOP PEOPLE SENT MONEY TO:
${personSends.map((p, i) => `- Person ${i + 1} (${p.relationship || "unclassified"}): KES ${p.totalSent.toLocaleString()}, ${p.frequency} times`).join("\n")}

LATE NIGHTS (10pm-4am):
- ${analytics.timePatterns.lateNightTransactions.count} transactions
- KES ${analytics.timePatterns.lateNightTransactions.total.toLocaleString()} total

SUBSCRIPTIONS:
- ${analytics.subscriptions.length} recurring services
- KES ${analytics.subscriptions.reduce((s, sub) => s + sub.monthlyCost, 0).toLocaleString()}/month total

STREAKS:
- Longest consecutive days using M-Pesa: ${analytics.streaks.longestConsecutiveDays}
- Busiest day: ${analytics.streaks.busiestDay.date} (${analytics.streaks.busiestDay.count} transactions)
- Quietest month: ${analytics.streaks.quietestMonth.month}

BIGGEST SINGLE TRANSACTION:
- KES ${analytics.extremes.biggestSingleTransaction.amount.toLocaleString()} (${analytics.extremes.biggestSingleTransaction.type.replaceAll("_", " ")})

Write the 10 cards. Make each one specific, punchy, and fun.`;

  return { systemPrompt, userPrompt };
}

export interface ReflectCard {
  cardType: string;
  headline: string;
  body: string;
}

export function parseReflectCards(llmOutput: string): ReflectCard[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = llmOutput.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback: parse line by line
  }

  // If JSON parsing fails, return empty — the generation should be retried
  return [];
}
