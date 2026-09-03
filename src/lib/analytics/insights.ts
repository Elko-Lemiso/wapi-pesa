import type {
  Transaction,
  MonthlyTrend,
  RecurringPayment,
  Subscription,
  DisposableIncomeInsight,
  IncomePredictabilityInsight,
  FragilityDayInsight,
  RunwayInsight,
  LifestyleCreepInsight,
  InflationExposureInsight,
  LeakTotalInsight,
  TrajectoryInsight,
  CounterpartyDirectionInsight,
  CashFlowForecastInsight,
  HouseholdStaffPayment,
} from "../parser/types";
import { isSelfName, isSelfPhone } from "../parser/identity";

const MIN_MONTHS = 3;

// === 1. Real Disposable Income ===

export function computeDisposableIncome(
  transactions: Transaction[],
  monthlyTrends: MonthlyTrend[],
  recurringPayments: RecurringPayment[],
  subscriptions: Subscription[],
  householdStaff: HouseholdStaffPayment[]
): DisposableIncomeInsight | null {
  if (monthlyTrends.length < MIN_MONTHS) return null;

  const monthlyIncome = monthlyTrends.reduce((s, m) => s + m.inflows, 0) / monthlyTrends.length;

  const obligationBreakdown: { name: string; amount: number }[] = [];

  // Recurring paybill/till obligations (monthly)
  for (const r of recurringPayments) {
    if (r.frequency === "monthly") {
      obligationBreakdown.push({ name: r.recipient, amount: r.amount });
    }
  }

  // Subscriptions
  for (const s of subscriptions) {
    if (!obligationBreakdown.some(o => o.name === s.name)) {
      obligationBreakdown.push({ name: s.name, amount: s.monthlyCost });
    }
  }

  // Household staff
  for (const h of householdStaff) {
    obligationBreakdown.push({ name: `Staff (${h.maskedPhone})`, amount: h.amount });
  }

  // Loan repayments (estimate monthly from total)
  const loanPayments = transactions.filter(t =>
    t.direction === "out" && (t.type === "fuliza" || t.type === "od_repayment" || t.type === "mshwari_deposit" || t.type === "kcb_mpesa")
  );
  const monthlyLoanRepay = loanPayments.reduce((s, t) => s + t.amount, 0) / monthlyTrends.length;
  if (monthlyLoanRepay > 0) {
    obligationBreakdown.push({ name: "Loan Repayments", amount: Math.round(monthlyLoanRepay) });
  }

  obligationBreakdown.sort((a, b) => b.amount - a.amount);
  const monthlyObligations = obligationBreakdown.reduce((s, o) => s + o.amount, 0);
  const disposableIncome = monthlyIncome - monthlyObligations;

  return {
    monthlyIncome: Math.round(monthlyIncome),
    monthlyObligations: Math.round(monthlyObligations),
    disposableIncome: Math.round(disposableIncome),
    obligationBreakdown: obligationBreakdown.slice(0, 10),
  };
}

// === 2. Income Predictability Score ===

export function computeIncomePredictability(monthlyTrends: MonthlyTrend[]): IncomePredictabilityInsight | null {
  if (monthlyTrends.length < MIN_MONTHS) return null;

  const inflows = monthlyTrends.map(m => m.inflows);
  const mean = inflows.reduce((s, v) => s + v, 0) / inflows.length;
  if (mean === 0) return null;

  const variance = inflows.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / inflows.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  let label: "stable" | "variable" | "volatile";
  if (cv < 0.15) label = "stable";
  else if (cv <= 0.4) label = "variable";
  else label = "volatile";

  const sorted = [...monthlyTrends].sort((a, b) => b.inflows - a.inflows);
  const highestMonth = { month: sorted[0].month, amount: sorted[0].inflows };
  const lowestMonth = { month: sorted[sorted.length - 1].month, amount: sorted[sorted.length - 1].inflows };

  return { cv: Math.round(cv * 1000) / 1000, label, mean: Math.round(mean), stdDev: Math.round(stdDev), highestMonth, lowestMonth };
}

// === 3. Fragility Day ===

export function computeFragilityDay(transactions: Transaction[]): FragilityDayInsight | null {
  if (transactions.length < 50) return null;

  // Average balance by day-of-month
  const dayBalances = new Map<number, number[]>();
  for (const t of transactions) {
    const dom = t.completionTime.getDate();
    if (!dayBalances.has(dom)) dayBalances.set(dom, []);
    dayBalances.get(dom)!.push(t.balance);
  }

  let lowestDay = 1;
  let lowestAvg = Infinity;
  let peakDay = 1;
  let peakAvg = 0;

  for (const [day, balances] of dayBalances) {
    const avg = balances.reduce((s, b) => s + b, 0) / balances.length;
    if (avg < lowestAvg) { lowestAvg = avg; lowestDay = day; }
    if (avg > peakAvg) { peakAvg = avg; peakDay = day; }
  }

  return {
    dayOfMonth: lowestDay,
    averageBalance: Math.round(lowestAvg),
    peakDay,
    peakBalance: Math.round(peakAvg),
  };
}

// === 4. Runway in Months ===

export function computeRunway(
  transactions: Transaction[],
  monthlyTrends: MonthlyTrend[]
): RunwayInsight | null {
  if (monthlyTrends.length < MIN_MONTHS) return null;

  // Current balance = last transaction's balance
  const sorted = [...transactions].sort((a, b) => b.completionTime.getTime() - a.completionTime.getTime());
  const currentBalance = sorted[0]?.balance || 0;

  // Essential categories
  const essentialTypes = new Set(["pay_bill", "withdraw_agent", "data_bundle", "airtime", "fuliza", "od_repayment", "mshwari_deposit", "kcb_mpesa"]);
  const essentialTxns = transactions.filter(t => t.direction === "out" && essentialTypes.has(t.type));
  const totalEssentials = essentialTxns.reduce((s, t) => s + t.amount, 0);
  const monthlyEssentials = totalEssentials / monthlyTrends.length;

  if (monthlyEssentials <= 0) return null;

  // Break down by category
  const catTotals = new Map<string, number>();
  for (const t of essentialTxns) {
    const cat = t.type;
    catTotals.set(cat, (catTotals.get(cat) || 0) + t.amount);
  }

  const essentialCategories = [...catTotals.entries()]
    .map(([name, total]) => ({ name: formatTypeName(name), monthly: Math.round(total / monthlyTrends.length) }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 6);

  return {
    months: Math.round((currentBalance / monthlyEssentials) * 10) / 10,
    currentBalance: Math.round(currentBalance),
    monthlyEssentials: Math.round(monthlyEssentials),
    essentialCategories,
  };
}

// === 5. Lifestyle Creep Detector ===

export function computeLifestyleCreep(
  transactions: Transaction[],
  monthlyTrends: MonthlyTrend[]
): LifestyleCreepInsight | null {
  if (monthlyTrends.length < 6) return null;

  const sorted = [...transactions]
    .filter(t => t.direction === "out")
    .sort((a, b) => a.completionTime.getTime() - b.completionTime.getTime());

  if (sorted.length < 20) return null;

  const totalDays = (sorted[sorted.length - 1].completionTime.getTime() - sorted[0].completionTime.getTime()) / (1000 * 60 * 60 * 24);
  const thirdDays = totalDays / 3;

  const earlyEnd = new Date(sorted[0].completionTime.getTime() + thirdDays * 1000 * 60 * 60 * 24);
  const lateStart = new Date(sorted[sorted.length - 1].completionTime.getTime() - thirdDays * 1000 * 60 * 60 * 24);

  // Group by counterparty (for recurring merchants)
  const counterpartyGroups = new Map<string, { early: number[]; late: number[]; earlyCount: number; lateCount: number }>();

  for (const t of sorted) {
    const key = t.counterparty.name || t.counterparty.paybillNumber || t.counterparty.tillNumber;
    if (!key) continue;
    if (!counterpartyGroups.has(key)) counterpartyGroups.set(key, { early: [], late: [], earlyCount: 0, lateCount: 0 });
    const g = counterpartyGroups.get(key)!;

    if (t.completionTime <= earlyEnd) {
      g.early.push(t.amount);
      g.earlyCount++;
    } else if (t.completionTime >= lateStart) {
      g.late.push(t.amount);
      g.lateCount++;
    }
  }

  const creepCategories: LifestyleCreepInsight["categories"] = [];

  for (const [category, g] of counterpartyGroups) {
    if (g.early.length < 3 || g.late.length < 3) continue;

    const earlyAvg = g.early.reduce((s, v) => s + v, 0) / g.early.length;
    const lateAvg = g.late.reduce((s, v) => s + v, 0) / g.late.length;
    if (earlyAvg === 0) continue;

    const growthPct = ((lateAvg - earlyAvg) / earlyAvg) * 100;
    const frequencyChange = ((g.lateCount - g.earlyCount) / g.earlyCount) * 100;

    // Flag: avg grew >20% while frequency stayed roughly flat (within 30%)
    if (growthPct > 20 && Math.abs(frequencyChange) < 30) {
      creepCategories.push({
        category,
        earlyAvg: Math.round(earlyAvg),
        lateAvg: Math.round(lateAvg),
        growthPct: Math.round(growthPct),
        frequencyChange: Math.round(frequencyChange),
      });
    }
  }

  if (creepCategories.length === 0) return null;

  creepCategories.sort((a, b) => b.growthPct - a.growthPct);
  return { categories: creepCategories.slice(0, 8) };
}

// === 6. Inflation Exposure ===

/**
 * Inflation Exposure shows how *fixed-purpose* recurring services have drifted
 * over time (utilities, subscriptions). It must NOT include:
 *   - bank transfers (variable amounts each time),
 *   - loan repayments (depend on outstanding balance),
 *   - restaurants / merchants where amounts vary widely.
 *
 * "Stable recurring" definition:
 *   - same merchant
 *   - 6+ transactions in the period
 *   - coefficient of variation on amount < 0.30
 *   - merchant name does NOT match excluded patterns (banks, loans, etc.)
 */
export function computeInflationExposure(
  transactions: Transaction[],
  monthlyTrends: MonthlyTrend[]
): InflationExposureInsight | null {
  if (monthlyTrends.length < 6) return null;

  const sorted = [...transactions]
    .filter((t) => t.direction === "out")
    .sort((a, b) => a.completionTime.getTime() - b.completionTime.getTime());

  const totalDays =
    sorted.length > 1
      ? (sorted[sorted.length - 1].completionTime.getTime() - sorted[0].completionTime.getTime()) /
        (1000 * 60 * 60 * 24)
      : 0;
  if (totalDays < 180) return null;

  const thirdDays = totalDays / 3;
  const earlyEnd = new Date(sorted[0].completionTime.getTime() + thirdDays * 1000 * 60 * 60 * 24);
  const lateStart = new Date(
    sorted[sorted.length - 1].completionTime.getTime() - thirdDays * 1000 * 60 * 60 * 24
  );

  // Group by paybill/till — these are unambiguous merchants.
  interface Group {
    name: string;
    all: number[];
    early: number[];
    late: number[];
  }
  const groups = new Map<string, Group>();

  for (const t of sorted) {
    const key = t.counterparty.paybillNumber || t.counterparty.tillNumber;
    if (!key) continue;

    // Skip transaction types that are not "fixed-purpose recurring services".
    if (
      t.type === "fuliza" ||
      t.type === "od_repayment" ||
      t.type === "mshwari_deposit" ||
      t.type === "mshwari_withdrawal" ||
      t.type === "kcb_mpesa"
    ) {
      continue;
    }

    const name = t.counterparty.name || key;

    if (!groups.has(key)) groups.set(key, { name, all: [], early: [], late: [] });
    const g = groups.get(key)!;
    g.all.push(t.amount);

    if (t.completionTime <= earlyEnd) g.early.push(t.amount);
    else if (t.completionTime >= lateStart) g.late.push(t.amount);
  }

  const merchants: InflationExposureInsight["merchants"] = [];

  for (const [, g] of groups) {
    if (g.early.length < 2 || g.late.length < 2) continue;
    if (g.all.length < 6) continue; // monthly cadence over a year ≈ 12 obs; require 6+

    if (isInflationExclusionMerchant(g.name)) continue;

    const mean = g.all.reduce((s, v) => s + v, 0) / g.all.length;
    if (mean === 0) continue;
    const variance = g.all.reduce((s, v) => s + (v - mean) ** 2, 0) / g.all.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv >= 0.3) continue; // amounts vary too much — not stable recurring

    const earliestAvg = g.early.reduce((s, v) => s + v, 0) / g.early.length;
    const latestAvg = g.late.reduce((s, v) => s + v, 0) / g.late.length;
    if (earliestAvg === 0) continue;

    const changePct = ((latestAvg - earliestAvg) / earliestAvg) * 100;
    if (Math.abs(changePct) <= 5) continue; // not a meaningful change

    merchants.push({
      name: g.name,
      earliestAvg: Math.round(earliestAvg),
      latestAvg: Math.round(latestAvg),
      changePct: Math.round(changePct),
    });
  }

  if (merchants.length === 0) return null;

  merchants.sort((a, b) => b.changePct - a.changePct);
  const averageInflation = merchants.reduce((s, m) => s + m.changePct, 0) / merchants.length;

  return { merchants: merchants.slice(0, 8), averageInflation: Math.round(averageInflation) };
}

/**
 * Names of merchants that should never appear in inflation exposure because
 * the amounts are inherently variable: banks, loans, restaurants, etc.
 */
function isInflationExclusionMerchant(name: string): boolean {
  const upper = name.toUpperCase();
  if (/\bBANK\b/.test(upper)) return true;
  if (/\bSACCO\b/.test(upper)) return true;
  if (/\bLOAN\b/.test(upper)) return true;
  if (/\bCREDIT\b/.test(upper)) return true;
  if (/\bOVERDRAFT\b/.test(upper) || /\bOD\b/.test(upper)) return true;
  if (/\bFINANCE\b/.test(upper)) return true;
  if (/\bFULIZA\b/.test(upper)) return true;
  if (/\bM-?SHWARI\b/.test(upper)) return true;
  if (/\bKCB\b/.test(upper)) return true;
  return false;
}

// === 7. Leak Total ===

export function computeLeakTotal(
  recurringPayments: RecurringPayment[],
  subscriptions: Subscription[]
): LeakTotalInsight | null {
  const items: { name: string; monthlyCost: number; annualCost: number }[] = [];

  // Sub-500/month recurring payments
  for (const r of recurringPayments) {
    if (r.frequency === "monthly" && r.amount < 500 && r.amount > 0) {
      items.push({ name: r.recipient, monthlyCost: r.amount, annualCost: r.amount * 12 });
    }
  }

  for (const s of subscriptions) {
    if (s.monthlyCost < 500 && s.monthlyCost > 0 && !items.some(i => i.name === s.name)) {
      items.push({ name: s.name, monthlyCost: s.monthlyCost, annualCost: s.monthlyCost * 12 });
    }
  }

  if (items.length === 0) return null;

  items.sort((a, b) => b.annualCost - a.annualCost);
  const monthlyTotal = items.reduce((s, i) => s + i.monthlyCost, 0);
  const annualTotal = items.reduce((s, i) => s + i.annualCost, 0);

  return { annualTotal, monthlyTotal, items: items.slice(0, 10) };
}

// === 8. Income vs Spending Trajectory ===

export function computeTrajectory(monthlyTrends: MonthlyTrend[]): TrajectoryInsight | null {
  if (monthlyTrends.length < MIN_MONTHS) return null;

  const incomeSlope = linearRegressionSlope(monthlyTrends.map(m => m.inflows));
  const spendingSlope = linearRegressionSlope(monthlyTrends.map(m => m.outflows));
  const netSlope = incomeSlope - spendingSlope;

  let direction: "gaining" | "losing" | "stable";
  if (netSlope > 5000) direction = "gaining";
  else if (netSlope < -5000) direction = "losing";
  else direction = "stable";

  return {
    incomeSlope: Math.round(incomeSlope),
    spendingSlope: Math.round(spendingSlope),
    netSlope: Math.round(netSlope),
    direction,
  };
}

// === 9. Counterparty Direction ===

export function computeCounterpartyDirection(
  transactions: Transaction[],
  ownerPhone?: string | null,
  accountHolder?: string | null
): CounterpartyDirectionInsight | null {
  // Composite key (Bug 1) so two distinct people sharing a masked-phone don't merge.
  const contactMap = new Map<string, { name: string; phone: string; sent: number; received: number }>();

  for (const t of transactions) {
    if (!t.counterparty.phoneNumber) continue;
    if (t.type !== "send_money" && t.type !== "receive_money") continue;
    if (isSelfPhone(t.counterparty.phoneNumber, ownerPhone ?? null)) continue;
    if (isSelfName(t.counterparty.name, accountHolder ?? null)) continue;

    const phone = t.counterparty.phoneNumber;
    const name = t.counterparty.name || phone;
    const key = `${name.toUpperCase()}|${phone}`;
    if (!contactMap.has(key)) {
      contactMap.set(key, { name, phone, sent: 0, received: 0 });
    }
    const c = contactMap.get(key)!;
    if (t.direction === "out") c.sent += t.amount;
    else c.received += t.amount;
  }

  const contacts = [...contactMap.values()]
    .filter((c) => {
      // Need at least 3 txns *with this same name+phone composite* to surface.
      const totalTxns = transactions.filter(
        (t) =>
          t.counterparty.phoneNumber === c.phone &&
          (t.counterparty.name || c.phone) === c.name
      ).length;
      return totalTxns >= 3;
    })
    .map((c) => ({ ...c, netFlow: c.received - c.sent }))
    .sort((a, b) => Math.abs(b.netFlow) - Math.abs(a.netFlow))
    .slice(0, 12);

  if (contacts.length === 0) return null;
  return { contacts };
}

// === 10. Cash Flow Forecast ===

export function computeCashFlowForecast(
  transactions: Transaction[],
  monthlyTrends: MonthlyTrend[],
  recurringPayments: RecurringPayment[]
): CashFlowForecastInsight | null {
  if (monthlyTrends.length < MIN_MONTHS) return null;

  const sorted = [...transactions].sort((a, b) => b.completionTime.getTime() - a.completionTime.getTime());
  const currentBalance = sorted[0]?.balance || 0;

  // Monthly expected income (average)
  const monthlyIncome = monthlyTrends.reduce((s, m) => s + m.inflows, 0) / monthlyTrends.length;
  const dailyIncome = monthlyIncome / 30;

  // Monthly expected outflows from recurring + average variable
  const monthlyRecurring = recurringPayments
    .filter(r => r.frequency === "monthly")
    .reduce((s, r) => s + r.amount, 0);
  const monthlyVariable = monthlyTrends.reduce((s, m) => s + m.outflows, 0) / monthlyTrends.length - monthlyRecurring;
  const dailyOutflow = (monthlyRecurring + monthlyVariable) / 30;

  const now = new Date();
  const projections: CashFlowForecastInsight["projections"] = [];

  for (const days of [30, 60, 90]) {
    const date = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const expectedIncome = dailyIncome * days;
    const expectedOutflows = dailyOutflow * days;
    const expectedBalance = currentBalance + expectedIncome - expectedOutflows;

    projections.push({
      days,
      date: date.toISOString().slice(0, 10),
      expectedBalance: Math.round(expectedBalance),
      expectedIncome: Math.round(expectedIncome),
      expectedOutflows: Math.round(expectedOutflows),
    });
  }

  return { currentBalance: Math.round(currentBalance), projections };
}

// === Helpers ===

function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function formatTypeName(type: string): string {
  return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
