import { getDb } from "./client";
import { categoryBenchmarks, householdBenchmarks, volumeDistributions } from "./schema";
import type { AnalyticsResult } from "../parser/types";

export async function contributeAnonymizedData(analytics: AnalyticsResult): Promise<void> {
  const periodMonths = analytics.monthlyTrends.length || 1;

  try {
    const db = getDb();
    // Contribute category breakdowns (anonymized — no user ID, no amounts attributable)
    const categoryInserts = analytics.categoryBreakdown.map((cat) => ({
      category: cat.category,
      percentageOfTotal: cat.percentage,
      absoluteAmount: cat.total,
      transactionCount: cat.transactionCount,
      periodMonths,
    }));

    if (categoryInserts.length > 0) {
      await db.insert(categoryBenchmarks).values(categoryInserts);
    }

    // Contribute household staff benchmarks
    const householdInserts = analytics.householdStaff.map((hs) => ({
      monthlyAmount: hs.amount,
      inferredRole: hs.inferredRole,
      monthsDetected: hs.monthsDetected,
    }));

    if (householdInserts.length > 0) {
      await db.insert(householdBenchmarks).values(householdInserts);
    }

    // Contribute volume distribution
    const categoryBreakdown: Record<string, number> = {};
    for (const cat of analytics.categoryBreakdown) {
      categoryBreakdown[cat.category] = cat.percentage;
    }

    await db.insert(volumeDistributions).values({
      totalInflows: analytics.totalInflows,
      totalOutflows: analytics.totalOutflows,
      transactionCount: analytics.transactionCount,
      periodMonths,
      subscriptionCount: analytics.subscriptions.length,
      lenderCount: analytics.mobileLoanActivity.lenders.length,
      categoryBreakdown,
    });
  } catch (error) {
    // Benchmark contribution is best-effort — never block the user flow
    console.error("Benchmark contribution failed:", error);
  }
}
