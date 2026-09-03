import { pgTable, serial, text, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const categoryBenchmarks = pgTable("category_benchmarks", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  percentageOfTotal: real("percentage_of_total").notNull(),
  absoluteAmount: real("absolute_amount").notNull(),
  transactionCount: integer("transaction_count").notNull(),
  periodMonths: integer("period_months").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const householdBenchmarks = pgTable("household_benchmarks", {
  id: serial("id").primaryKey(),
  monthlyAmount: real("monthly_amount").notNull(),
  inferredRole: text("inferred_role"),
  monthsDetected: integer("months_detected").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const volumeDistributions = pgTable("volume_distributions", {
  id: serial("id").primaryKey(),
  totalInflows: real("total_inflows").notNull(),
  totalOutflows: real("total_outflows").notNull(),
  transactionCount: integer("transaction_count").notNull(),
  periodMonths: integer("period_months").notNull(),
  subscriptionCount: integer("subscription_count").notNull(),
  lenderCount: integer("lender_count").notNull(),
  categoryBreakdown: jsonb("category_breakdown").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
