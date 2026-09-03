export type TransactionType =
  | "send_money"
  | "receive_money"
  | "pay_bill"
  | "buy_goods"
  | "pochi_la_biashara"
  | "mshwari_deposit"
  | "mshwari_withdrawal"
  | "kcb_mpesa"
  | "fuliza"
  | "airtime"
  | "withdraw_agent"
  | "deposit_agent"
  | "lipa_na_mpesa"
  | "reversal"
  | "international_transfer"
  | "globalpay"
  | "data_bundle"
  | "promotion"
  | "salary"
  | "od_repayment"
  | "unknown";

export interface Transaction {
  receiptNo: string;
  completionTime: Date;
  details: string;
  status: "Completed" | "Failed" | string;
  amount: number;
  direction: "in" | "out";
  fee: number;
  overdraftUsed: number;
  // Keep paidIn/withdrawn for backward compat — these represent PRINCIPAL only
  paidIn: number;
  withdrawn: number;
  balance: number;
  type: TransactionType;
  counterparty: CounterpartyInfo;
}

export interface CounterpartyInfo {
  name: string | null;
  phoneNumber: string | null;
  paybillNumber: string | null;
  tillNumber: string | null;
  accountNumber: string | null;
}

export interface ParsedStatement {
  transactions: Transaction[];
  accountHolder: string | null;
  phoneNumber: string | null;
  statementPeriod: {
    from: Date;
    to: Date;
  } | null;
  currency: string;
}

export interface ReconciliationSummary {
  /** total of all "in" principal amounts */
  totalInflow: number;
  /** total of all "out" principal amounts */
  totalOutflow: number;
  /** total of all fee rows */
  totalFees: number;
  /** in − out − fees */
  computedDelta: number;
  /** lastBalance − preBalanceOfFirstTxn */
  observedDelta: number;
  /** observedDelta − computedDelta */
  discrepancy: number;
  /** discrepancy as % of total volume (in + out) */
  discrepancyPct: number;
  /** true when |discrepancy| ≤ max(KES 100, 1% of volume) */
  reconciles: boolean;
}

export interface SelfTransferSummary {
  count: number;
  totalAmount: number;
  destinations: { name: string; count: number; total: number }[];
}

export interface AnalyticsResult {
  totalInflows: number;
  totalOutflows: number;
  netFlow: number;
  transactionCount: number;
  period: { from: Date; to: Date } | null;
  reconciliation: ReconciliationSummary;
  selfTransfers: SelfTransferSummary;

  categoryBreakdown: CategorySpending[];
  topCounterpartiesByAmount: CounterpartySummary[];
  topCounterpartiesByFrequency: CounterpartySummary[];
  recurringPayments: RecurringPayment[];
  householdStaff: HouseholdStaffPayment[];
  timePatterns: TimePatterns;
  mobileLoanActivity: MobileLoanSummary;
  monthlyTrends: MonthlyTrend[];
  streaks: StreakInfo;
  extremes: Extremes;
  subscriptions: Subscription[];
  personToPersonSends: PersonSendSummary[];

  // Extended analytics
  feesBreakdown: FeesBreakdown;
  internationalTransfers: InternationalTransferSummary;
  globalPayMerchants: GlobalPayMerchant[];
  dataAndAirtime: DataAirtimeSummary;
  balanceOverTime: BalancePoint[];
  incomeStreams: IncomeStream[];
  promotionsAndCashback: PromotionSummary;

  // Deep insights
  disposableIncome: DisposableIncomeInsight | null;
  incomePredictability: IncomePredictabilityInsight | null;
  fragilityDay: FragilityDayInsight | null;
  runwayMonths: RunwayInsight | null;
  lifestyleCreep: LifestyleCreepInsight | null;
  inflationExposure: InflationExposureInsight | null;
  leakTotal: LeakTotalInsight | null;
  trajectory: TrajectoryInsight | null;
  counterpartyDirection: CounterpartyDirectionInsight | null;
  cashFlowForecast: CashFlowForecastInsight | null;
}

export interface CategorySpending {
  category: string;
  total: number;
  percentage: number;
  transactionCount: number;
}

export interface CounterpartySummary {
  name: string;
  maskedPhone: string | null;
  paybill: string | null;
  till: string | null;
  totalAmount: number;
  frequency: number;
  category: string | null;
}

export interface RecurringPayment {
  recipient: string;
  recipientType: "paybill" | "phone" | "till";
  amount: number;
  frequency: "daily" | "weekly" | "monthly";
  category: string | null;
  totalSpent: number;
  occurrences: number;
}

export interface HouseholdStaffPayment {
  maskedPhone: string;
  amount: number;
  frequency: "monthly";
  totalPaid: number;
  monthsDetected: number;
  inferredRole: string | null;
}

export interface TimePatterns {
  hourlyDistribution: number[];
  weekdayVsWeekend: { weekday: number; weekend: number };
  lateNightTransactions: { count: number; total: number };
}

export interface MobileLoanSummary {
  lenders: MobileLenderDetail[];
  totalBorrowed: number;
  totalRepaid: number;
  totalFees: number;
  effectiveAnnualRate: number | null;
}

export interface MobileLenderDetail {
  name: string;
  borrowed: number;
  repaid: number;
  fees: number;
  transactions: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  inflows: number;
  outflows: number;
  net: number;
  transactionCount: number;
}

export interface StreakInfo {
  longestConsecutiveDays: number;
  busiestDay: { date: string; count: number; total: number };
  quietestMonth: { month: string; count: number };
  busiestMonth: { month: string; count: number };
}

export interface Extremes {
  biggestSingleTransaction: {
    amount: number;
    recipient: string;
    date: Date;
    type: TransactionType;
  };
  smallestTransaction: { amount: number; date: Date };
  biggestInflow: { amount: number; source: string; date: Date };
}

export interface Subscription {
  name: string;
  paybill: string | null;
  monthlyCost: number;
  totalCost: number;
  isIdentified: boolean;
  category: string | null;
}

export interface PersonSendSummary {
  nameOrInitial: string;
  maskedPhone: string;
  totalSent: number;
  frequency: number;
  /** Relationship inference, populated by the relationship classifier. */
  relationship?: RecipientRelationship;
  /** 0..1 — how confident the classifier is. */
  relationshipConfidence?: number;
  /** Human-readable role hint, e.g. "Likely rent or recurring large bill". */
  inferredRole?: string;
  /** Distinct months that contained a send to this counterparty. */
  monthsActive?: number;
  /** Coefficient of variation across send amounts; 0 = perfectly stable. */
  amountCV?: number;
  /** Cadence inferred from inter-event gaps. */
  cadence?: "weekly" | "biweekly" | "monthly" | "irregular";
  /** Total KES received from this same phone number (reciprocity signal). */
  receivedFromSame?: number;
}

/**
 * Relationship classification for a person we send money to. Used by the
 * Reflect cards to pick correct framing: a recipient on a "rent" cadence
 * should never get a "they owe you a meal" tagline.
 */
export type RecipientRelationship =
  | "rent"           // monthly, large, very stable, no reciprocity
  | "staff"          // monthly, mid amount, very stable, no reciprocity
  | "family"         // recurring but varied amount, no/low reciprocity
  | "friend"         // irregular OR reciprocal
  | "casual"         // few one-off small sends
  | "savings"        // sends to known savings/insurance phones (rare via P2P)
  | "unknown";

// === New types ===

export interface FeesBreakdown {
  totalFees: number;
  sendMoneyFees: number;
  paybillFees: number;
  merchantFees: number;
  withdrawalFees: number;
  otherFees: number;
  feesAsPercentage: number;
}

export interface InternationalTransferSummary {
  totalReceived: number;
  transferCount: number;
  sources: { name: string; total: number; count: number }[];
  averageTransfer: number;
  largestTransfer: { amount: number; source: string; date: Date };
}

export interface GlobalPayMerchant {
  merchantName: string;
  country: string;
  totalSpent: number;
  transactionCount: number;
  lastDate: Date;
}

export interface DataAirtimeSummary {
  totalDataSpend: number;
  totalAirtimeSpend: number;
  dataPurchaseCount: number;
  airtimePurchaseCount: number;
  averageDataPurchase: number;
  monthlyAverage: number;
}

export interface BalancePoint {
  date: string;
  balance: number;
}

export interface IncomeStream {
  source: string;
  type: "salary" | "international" | "business" | "other";
  totalAmount: number;
  frequency: number;
  averageAmount: number;
}

export interface PromotionSummary {
  totalReceived: number;
  count: number;
  sources: { name: string; total: number; count: number }[];
}

// === Deep Insight types ===

export interface DisposableIncomeInsight {
  monthlyIncome: number;
  monthlyObligations: number;
  disposableIncome: number;
  obligationBreakdown: { name: string; amount: number }[];
}

export interface IncomePredictabilityInsight {
  cv: number;
  label: "stable" | "variable" | "volatile";
  mean: number;
  stdDev: number;
  highestMonth: { month: string; amount: number };
  lowestMonth: { month: string; amount: number };
}

export interface FragilityDayInsight {
  dayOfMonth: number;
  averageBalance: number;
  peakDay: number;
  peakBalance: number;
}

export interface RunwayInsight {
  months: number;
  currentBalance: number;
  monthlyEssentials: number;
  essentialCategories: { name: string; monthly: number }[];
}

export interface LifestyleCreepInsight {
  categories: {
    category: string;
    earlyAvg: number;
    lateAvg: number;
    growthPct: number;
    frequencyChange: number;
  }[];
}

export interface InflationExposureInsight {
  merchants: {
    name: string;
    earliestAvg: number;
    latestAvg: number;
    changePct: number;
  }[];
  averageInflation: number;
}

export interface LeakTotalInsight {
  annualTotal: number;
  monthlyTotal: number;
  items: { name: string; monthlyCost: number; annualCost: number }[];
}

export interface TrajectoryInsight {
  incomeSlope: number;
  spendingSlope: number;
  netSlope: number;
  direction: "gaining" | "losing" | "stable";
}

export interface CounterpartyDirectionInsight {
  contacts: {
    name: string;
    phone: string;
    sent: number;
    received: number;
    netFlow: number;
  }[];
}

export interface CashFlowForecastInsight {
  currentBalance: number;
  projections: {
    days: number;
    date: string;
    expectedBalance: number;
    expectedIncome: number;
    expectedOutflows: number;
  }[];
}
