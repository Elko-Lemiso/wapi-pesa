import type {
  Transaction,
  TransactionType,
  ParsedStatement,
  AnalyticsResult,
  CategorySpending,
  CounterpartySummary,
  MonthlyTrend,
  StreakInfo,
  Extremes,
  TimePatterns,
  PersonSendSummary,
  SelfTransferSummary,
} from "../parser/types";
import { reconcile } from "../parser/extract-transactions";
import { detectRecurringPayments, detectSubscriptions } from "./recurring";
import { detectHouseholdStaff } from "./household";
import { analyzeMobileLoans } from "./loans";
import { enrichPersonSends } from "./relationships";
import {
  computeFeesBreakdown,
  computeInternationalTransfers,
  computeGlobalPayMerchants,
  computeDataAirtime,
  computeBalanceOverTime,
  computeIncomeStreams,
  computePromotions,
} from "./extended";
import {
  computeDisposableIncome,
  computeIncomePredictability,
  computeFragilityDay,
  computeRunway,
  computeLifestyleCreep,
  computeInflationExposure,
  computeLeakTotal,
  computeTrajectory,
  computeCounterpartyDirection,
  computeCashFlowForecast,
} from "./insights";
import { lookupPaybill, lookupTill } from "../registry/paybills";
import type { Category } from "../registry/categories";
import { CATEGORIES } from "../registry/categories";
import { categorize } from "../registry/categorize";
import {
  contactKey,
  isSelfPhone,
  isSelfTransfer,
  maskForDisplay,
} from "../parser/identity";

export function computeAnalytics(statement: ParsedStatement): AnalyticsResult {
  const { transactions, accountHolder } = statement;
  const completed = transactions.filter((t) => t.status === "Completed");
  const ownerPhone = statement.phoneNumber;

  // Use direction/amount fields — these already exclude overdraft credits and fees
  const totalInflows = completed
    .filter((t) => t.direction === "in")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOutflows = completed
    .filter((t) => t.direction === "out")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalFees = completed.reduce((sum, t) => sum + t.fee, 0);
  const netFlow = totalInflows - totalOutflows - totalFees;

  // Build a self-transfer predicate once and pass it to everything that needs
  // to exclude self-transfers from its output (Bug 4).
  //
  // Only Customer-Transfer-style sends qualify. The user buying airtime / data
  // for their own line is NOT a self-transfer — it's a utilities purchase.
  const SELF_ELIGIBLE_TYPES = new Set([
    "send_money",
    "receive_money",
  ]);
  const isSelf = (t: Transaction): boolean => {
    if (!SELF_ELIGIBLE_TYPES.has(t.type)) return false;
    return isSelfTransfer({
      counterpartyPhone: t.counterparty.phoneNumber,
      counterpartyName: t.counterparty.name,
      ownerPhone,
      accountHolder,
    });
  };

  /**
   * Broader version that catches the holder's own number/name regardless of
   * transaction type. Used to suppress the holder from "top contacts" panels —
   * data bundle purchases on your own line shouldn't make you a top recipient
   * of yourself.
   */
  const isSelfCounterparty = (t: Transaction): boolean =>
    isSelfTransfer({
      counterpartyPhone: t.counterparty.phoneNumber,
      counterpartyName: t.counterparty.name,
      ownerPhone,
      accountHolder,
    });

  const recurringPayments = detectRecurringPayments(completed, { isSelf });
  const householdStaff = detectHouseholdStaff(completed);
  const monthlyTrends = computeMonthlyTrends(completed);
  const subscriptions = detectSubscriptions(completed, { isSelf });

  const reconciliation = reconcile(completed);
  if (!reconciliation.reconciles) {
    // Fail loudly: the report relies on the parser balancing. We surface
    // this in the AnalyticsResult AND log to the server so we notice.
    console.warn(
      `[parser] reconciliation off by KES ${reconciliation.discrepancy.toFixed(2)} ` +
        `(${reconciliation.discrepancyPct.toFixed(2)}%) — ` +
        `in=${reconciliation.totalInflow} out=${reconciliation.totalOutflow} ` +
        `fees=${reconciliation.totalFees} computedΔ=${reconciliation.computedDelta} ` +
        `observedΔ=${reconciliation.observedDelta}`
    );
  }

  return {
    totalInflows,
    totalOutflows,
    netFlow,
    transactionCount: completed.length,
    period: statement.statementPeriod,
    reconciliation,
    selfTransfers: computeSelfTransferSummary(completed, isSelf),
    categoryBreakdown: computeCategoryBreakdown(completed, isSelf),
    topCounterpartiesByAmount: computeTopByAmount(completed, isSelfCounterparty),
    topCounterpartiesByFrequency: computeTopByFrequency(completed, isSelfCounterparty),
    recurringPayments,
    householdStaff,
    timePatterns: computeTimePatterns(completed),
    mobileLoanActivity: analyzeMobileLoans(completed),
    monthlyTrends,
    streaks: computeStreaks(completed, statement.statementPeriod),
    extremes: computeExtremes(completed),
    subscriptions,
    personToPersonSends: enrichPersonSends(
      computePersonSends(completed, ownerPhone, isSelfCounterparty),
      completed
    ),
    feesBreakdown: computeFeesBreakdown(completed),
    internationalTransfers: computeInternationalTransfers(completed),
    globalPayMerchants: computeGlobalPayMerchants(completed),
    dataAndAirtime: computeDataAirtime(completed),
    balanceOverTime: computeBalanceOverTime(completed),
    incomeStreams: computeIncomeStreams(completed),
    promotionsAndCashback: computePromotions(completed),

    // Deep insights
    disposableIncome: computeDisposableIncome(completed, monthlyTrends, recurringPayments, subscriptions, householdStaff),
    incomePredictability: computeIncomePredictability(monthlyTrends),
    fragilityDay: computeFragilityDay(completed),
    runwayMonths: computeRunway(completed, monthlyTrends),
    lifestyleCreep: computeLifestyleCreep(completed, monthlyTrends),
    inflationExposure: computeInflationExposure(completed, monthlyTrends),
    leakTotal: computeLeakTotal(recurringPayments, subscriptions),
    trajectory: computeTrajectory(monthlyTrends),
    counterpartyDirection: computeCounterpartyDirection(completed, ownerPhone, accountHolder),
    cashFlowForecast: computeCashFlowForecast(completed, monthlyTrends, recurringPayments),
  };
}

function computeCategoryBreakdown(
  transactions: Transaction[],
  isSelf: (t: Transaction) => boolean
): CategorySpending[] {
  const outgoing = transactions.filter((t) => t.direction === "out");
  const totalSpent = outgoing.reduce((sum, t) => sum + t.amount, 0);

  const byCategory = new Map<string, { total: number; count: number }>();

  for (const t of outgoing) {
    const cat = categorize(t, isSelf).category;
    const existing = byCategory.get(cat) || { total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    byCategory.set(cat, existing);
  }

  return [...byCategory.entries()]
    .map(([category, data]) => ({
      category: CATEGORIES[category as Category] || category,
      total: Math.round(data.total * 100) / 100,
      percentage: totalSpent > 0 ? Math.round((data.total / totalSpent) * 10000) / 100 : 0,
      transactionCount: data.count,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Layered classification — exposed as a single helper for analytics callers. */
function resolveCategory(t: Transaction): string {
  return categorize(t).category;
}

function computeTopByAmount(
  transactions: Transaction[],
  isSelf: (t: Transaction) => boolean
): CounterpartySummary[] {
  const map = new Map<string, CounterpartySummary>();

  for (const t of transactions) {
    if (t.direction !== "out") continue;
    if (isSelf(t)) continue;
    // Composite key (Bug 1): name + maskedPhone, falling back to paybill/till.
    const key = aggregationKey(t);
    const existing = map.get(key);

    if (existing) {
      existing.totalAmount += t.amount;
      existing.frequency++;
    } else {
      map.set(key, {
        name: t.counterparty.name || displayKey(t),
        maskedPhone: t.counterparty.phoneNumber ? maskForDisplay(t.counterparty.phoneNumber) : null,
        paybill: t.counterparty.paybillNumber,
        till: t.counterparty.tillNumber,
        totalAmount: t.amount,
        frequency: 1,
        category: resolveCategory(t),
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 20);
}

function computeTopByFrequency(
  transactions: Transaction[],
  isSelf: (t: Transaction) => boolean
): CounterpartySummary[] {
  const map = new Map<string, CounterpartySummary>();

  for (const t of transactions) {
    if (t.direction !== "out") continue;
    if (isSelf(t)) continue;
    const key = aggregationKey(t);
    const existing = map.get(key);

    if (existing) {
      existing.totalAmount += t.amount;
      existing.frequency++;
    } else {
      map.set(key, {
        name: t.counterparty.name || displayKey(t),
        maskedPhone: t.counterparty.phoneNumber ? maskForDisplay(t.counterparty.phoneNumber) : null,
        paybill: t.counterparty.paybillNumber,
        till: t.counterparty.tillNumber,
        totalAmount: t.amount,
        frequency: 1,
        category: resolveCategory(t),
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20);
}

function computeTimePatterns(transactions: Transaction[]): TimePatterns {
  const hourlyDistribution = new Array(24).fill(0);
  let weekdayTotal = 0;
  let weekendTotal = 0;
  let lateNightCount = 0;
  let lateNightTotal = 0;

  for (const t of transactions) {
    const hour = t.completionTime.getHours();
    const day = t.completionTime.getDay();

    hourlyDistribution[hour]++;

    if (day === 0 || day === 6) {
      weekendTotal++;
    } else {
      weekdayTotal++;
    }

    if (hour >= 22 || hour < 4) {
      lateNightCount++;
      lateNightTotal += t.amount;
    }
  }

  return {
    hourlyDistribution,
    weekdayVsWeekend: { weekday: weekdayTotal, weekend: weekendTotal },
    lateNightTransactions: { count: lateNightCount, total: lateNightTotal },
  };
}

function computeMonthlyTrends(transactions: Transaction[]): MonthlyTrend[] {
  const map = new Map<string, MonthlyTrend>();

  for (const t of transactions) {
    const month = t.completionTime.getMonth();
    const year = t.completionTime.getFullYear();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthName = t.completionTime.toLocaleString("en-US", { month: "long" });

    const existing = map.get(key) || {
      month: monthName,
      year,
      inflows: 0,
      outflows: 0,
      net: 0,
      transactionCount: 0,
    };

    if (t.direction === "in") {
      existing.inflows += t.amount;
    } else {
      existing.outflows += t.amount + t.fee;
    }
    existing.net = existing.inflows - existing.outflows;
    existing.transactionCount++;
    map.set(key, existing);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function computeStreaks(transactions: Transaction[], period: { from: Date; to: Date } | null): StreakInfo {
  const sortedByDate = [...transactions].sort(
    (a, b) => a.completionTime.getTime() - b.completionTime.getTime()
  );

  const uniqueDays = new Set<string>();
  const dayCountMap = new Map<string, { count: number; total: number }>();
  const monthCountMap = new Map<string, number>();

  for (const t of sortedByDate) {
    const dayKey = t.completionTime.toISOString().slice(0, 10);
    uniqueDays.add(dayKey);

    const existing = dayCountMap.get(dayKey) || { count: 0, total: 0 };
    existing.count++;
    existing.total += t.amount;
    dayCountMap.set(dayKey, existing);

    const monthKey = t.completionTime.toLocaleString("en-US", { month: "long", year: "numeric" });
    monthCountMap.set(monthKey, (monthCountMap.get(monthKey) || 0) + 1);
  }

  const sortedDays = [...uniqueDays].sort();
  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  let busiestDay = { date: "", count: 0, total: 0 };
  for (const [date, data] of dayCountMap) {
    if (data.count > busiestDay.count) {
      busiestDay = { date, ...data };
    }
  }

  // Bug 7: exclude partial months from busiest/quietest. A month is partial
  // when it contains the statement boundary AND that boundary is not the last
  // day of the calendar month.
  const partialMonths = detectPartialMonths(monthCountMap, period, sortedByDate);
  const fullMonths = new Map<string, number>();
  for (const [month, count] of monthCountMap) {
    if (partialMonths.has(month)) continue;
    fullMonths.set(month, count);
  }

  let busiestMonth = { month: "", count: 0 };
  let quietestMonth = { month: "", count: Infinity };
  const monthsForComparison = fullMonths.size > 0 ? fullMonths : monthCountMap;
  for (const [month, count] of monthsForComparison) {
    if (count > busiestMonth.count) busiestMonth = { month, count };
    if (count < quietestMonth.count) quietestMonth = { month, count };
  }
  if (quietestMonth.count === Infinity) quietestMonth = { month: "N/A", count: 0 };

  return {
    longestConsecutiveDays: longestStreak,
    busiestDay,
    quietestMonth,
    busiestMonth,
  };
}

/**
 * A month is "partial" if either:
 *   - it contains the statement period start AND the start day > 1, OR
 *   - it contains the statement period end AND the end day < lastDayOfMonth.
 * If we don't have a statement period, fall back to looking at the
 * earliest/latest active dates.
 */
function detectPartialMonths(
  monthCountMap: Map<string, number>,
  period: { from: Date; to: Date } | null,
  sortedAsc: Transaction[]
): Set<string> {
  const partial = new Set<string>();
  if (monthCountMap.size === 0) return partial;

  const fromDate = period?.from ?? sortedAsc[0]?.completionTime;
  const toDate = period?.to ?? sortedAsc[sortedAsc.length - 1]?.completionTime;
  if (!fromDate || !toDate) return partial;

  const fromKey = fromDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const toKey = toDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  if (fromDate.getDate() > 1 && monthCountMap.has(fromKey)) {
    partial.add(fromKey);
  }
  const lastDay = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0).getDate();
  if (toDate.getDate() < lastDay && monthCountMap.has(toKey)) {
    partial.add(toKey);
  }
  return partial;
}

function computeExtremes(transactions: Transaction[]): Extremes {
  let biggestOut: { amount: number; recipient: string; date: Date; type: TransactionType } = { amount: 0, recipient: "", date: new Date(), type: "unknown" };
  let smallestOut = { amount: Infinity, date: new Date() };
  let biggestIn = { amount: 0, source: "", date: new Date() };

  for (const t of transactions) {
    if (t.direction === "out" && t.amount > biggestOut.amount) {
      biggestOut = {
        amount: t.amount,
        recipient: t.counterparty.name || displayKey(t),
        date: t.completionTime,
        type: t.type,
      };
    }
    if (t.direction === "out" && t.amount > 0 && t.amount < smallestOut.amount) {
      smallestOut = { amount: t.amount, date: t.completionTime };
    }
    if (t.direction === "in" && t.amount > biggestIn.amount) {
      biggestIn = {
        amount: t.amount,
        source: t.counterparty.name || displayKey(t),
        date: t.completionTime,
      };
    }
  }

  if (smallestOut.amount === Infinity) smallestOut.amount = 0;

  return {
    biggestSingleTransaction: biggestOut,
    smallestTransaction: smallestOut,
    biggestInflow: biggestIn,
  };
}

function computePersonSends(
  transactions: Transaction[],
  ownerPhone: string | null,
  isSelf: (t: Transaction) => boolean
): PersonSendSummary[] {
  // Composite key (name + maskedPhone) prevents two distinct people whose
  // numbers happen to share the same masked suffix from being merged. (Bug 1)
  const map = new Map<string, PersonSendSummary>();

  for (const t of transactions) {
    if (t.type !== "send_money" || !t.counterparty.phoneNumber) continue;
    if (isSelfPhone(t.counterparty.phoneNumber, ownerPhone)) continue;
    if (isSelf(t)) continue;

    const phone = t.counterparty.phoneNumber;
    const name = t.counterparty.name;
    const key = contactKey(name, phone);
    const existing = map.get(key);

    if (existing) {
      existing.totalSent += t.amount;
      existing.frequency++;
    } else {
      map.set(key, {
        nameOrInitial: name || "Unknown",
        maskedPhone: maskForDisplay(phone),
        totalSent: t.amount,
        frequency: 1,
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.totalSent - a.totalSent)
    .slice(0, 10);
}

/**
 * A composite key used to aggregate per-counterparty in the top-by-amount and
 * top-by-frequency tables. Designed to keep distinct named contacts apart even
 * when their masked phones collide. (Bug 1)
 */
function aggregationKey(t: Transaction): string {
  // Paybills and tills always identify a unique merchant — group by id directly.
  if (t.counterparty.paybillNumber) {
    return `paybill:${t.counterparty.paybillNumber}|${(t.counterparty.name || "").toUpperCase()}`;
  }
  if (t.counterparty.tillNumber) {
    return `till:${t.counterparty.tillNumber}`;
  }
  return contactKey(t.counterparty.name, t.counterparty.phoneNumber);
}

function computeSelfTransferSummary(
  transactions: Transaction[],
  isSelf: (t: Transaction) => boolean
): SelfTransferSummary {
  const dests = new Map<string, { name: string; count: number; total: number }>();
  let count = 0;
  let totalAmount = 0;

  for (const t of transactions) {
    if (t.direction !== "out") continue;
    if (!isSelf(t)) continue;
    count++;
    totalAmount += t.amount;
    const name =
      t.counterparty.name ||
      (t.counterparty.paybillNumber ? `Paybill ${t.counterparty.paybillNumber}` : null) ||
      (t.counterparty.phoneNumber ? maskForDisplay(t.counterparty.phoneNumber) : null) ||
      "Self";
    const existing = dests.get(name) || { name, count: 0, total: 0 };
    existing.count++;
    existing.total += t.amount;
    dests.set(name, existing);
  }

  return {
    count,
    totalAmount: Math.round(totalAmount),
    destinations: [...dests.values()].sort((a, b) => b.total - a.total).slice(0, 8),
  };
}

function displayKey(t: Transaction): string {
  if (t.counterparty.paybillNumber) {
    const entry = lookupPaybill(t.counterparty.paybillNumber);
    return entry?.name || `Paybill ${t.counterparty.paybillNumber}`;
  }
  if (t.counterparty.tillNumber) {
    const entry = lookupTill(t.counterparty.tillNumber);
    return entry?.name || `Till ${t.counterparty.tillNumber}`;
  }
  if (t.counterparty.phoneNumber) return maskForDisplay(t.counterparty.phoneNumber);
  return "Unknown";
}
