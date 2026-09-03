import { getDb } from "./client";
import { categoryBenchmarks, volumeDistributions } from "./schema";
import { sql, count, avg } from "drizzle-orm";

export interface CategoryPercentile {
  category: string;
  p25: number;
  p50: number;
  p75: number;
  sampleSize: number;
}

export async function getCategoryPercentiles(): Promise<CategoryPercentile[]> {
  const db = getDb();
  const result = await db
    .select({
      category: categoryBenchmarks.category,
      avgPercentage: avg(categoryBenchmarks.percentageOfTotal),
      sampleSize: count(),
    })
    .from(categoryBenchmarks)
    .groupBy(categoryBenchmarks.category);

  return result.map((r) => ({
    category: r.category,
    p25: Number(r.avgPercentage) * 0.7,
    p50: Number(r.avgPercentage),
    p75: Number(r.avgPercentage) * 1.3,
    sampleSize: Number(r.sampleSize),
  }));
}

export async function getTotalUserCount(): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ total: count() })
    .from(volumeDistributions);

  return Number(result[0]?.total || 0);
}

export async function getSpendingPercentile(
  category: string,
  userPercentage: number
): Promise<number | null> {
  const db = getDb();
  const result = await db
    .select({ total: count() })
    .from(categoryBenchmarks)
    .where(sql`${categoryBenchmarks.category} = ${category} AND ${categoryBenchmarks.percentageOfTotal} <= ${userPercentage}`);

  const totalInCategory = await db
    .select({ total: count() })
    .from(categoryBenchmarks)
    .where(sql`${categoryBenchmarks.category} = ${category}`);

  const below = Number(result[0]?.total || 0);
  const total = Number(totalInCategory[0]?.total || 0);

  if (total < 50) return null;

  return Math.round((below / total) * 100);
}
