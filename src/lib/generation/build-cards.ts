import type {
  AnalyticsResult,
  CounterpartySummary,
  PersonSendSummary,
  RecipientRelationship,
  Subscription,
} from "../parser/types";

/**
 * Wapi Pesa Reflect — share card data builder.
 *
 * Produces a list of fully-populated card descriptions. Each card has a
 * type-discriminated `data` slot so the renderer can lay it out correctly,
 * plus flat `headline` / `body` strings for the PDF compilation that doesn't
 * understand the typed shape.
 *
 * Relationship-aware: every tagline pool is keyed by RecipientRelationship,
 * so a recurring monthly "rent" recipient never gets a "they owe you a meal"
 * line, and household staff never get framed as "best friends forever". See
 * `lib/analytics/relationships.ts` for how relationships are inferred.
 */

// =============================================================================
// Card shapes
// =============================================================================

export type AccentKey =
  | "white"
  | "coral"
  | "teal"
  | "purple"
  | "amber"
  | "blue"
  | "gold"
  | "magenta"
  | "neutral"
  | "multi";

interface CardBase {
  /** Stable id, used in URLs / filenames. */
  id: string;
  index: number;
  total: number;
  accent: AccentKey;
  /** Single-line dry observation. */
  tagline: string;
  /** Flat strings kept for the multi-page PDF compilation. */
  headline: string;
  body: string;
}

export interface HeadlineCard extends CardBase {
  cardType: "headline";
  data: {
    bigNumber: string;
    bigNumberRaw: number;
    subtitle: string;
    txCount: string;
    netLabel: string;
    netPositive: boolean;
  };
}

export interface TopRecipientCard extends CardBase {
  cardType: "topRecipient";
  data: {
    eyebrow: string;
    name: string;
    fullName: string;
    privacyName: string;
    amount: string;
    amountRaw: number;
    frequency: string;
    avgPerSend: string;
    /** Relationship tag — used by the renderer to pick supporting copy. */
    relationship: RecipientRelationship;
    relationshipLabel: string; // pretty label, e.g. "rent" / "household"
  };
}

export interface TopMerchantCard extends CardBase {
  cardType: "topMerchant";
  data: {
    eyebrow: string;
    merchant: string;
    amount: string;
    amountRaw: number;
    visits: number;
    avgPerVisit: string;
  };
}

export interface LateNightCard extends CardBase {
  cardType: "lateNight";
  data: {
    bigNumber: string;
    bigLabel: string;
    amount: string;
    count: number;
    hourly: number[];
  };
}

export interface FulizaCard extends CardBase {
  cardType: "fuliza";
  data: {
    eventCount: number;
    feesPaid: string;
    feesPaidRaw: number;
    busiestMonth: string | null;
  };
}

export interface SubscriptionsCard extends CardBase {
  cardType: "subscriptions";
  data: {
    annualTotal: string;
    annualTotalRaw: number;
    monthlyTotal: string;
    serviceCount: number;
    top: { name: string; monthly: string }[];
  };
}

export interface BillsMapRow {
  rank: number;
  name: string;
  privacyName: string;
  amount: string;
  amountRaw: number;
  share: number;
  /** Pretty role label: "rent", "household", "school", "service" etc. */
  roleLabel: string;
}

export interface BillsMapCard extends CardBase {
  cardType: "billsMap";
  data: {
    rows: BillsMapRow[];
    annualTotal: string;
    annualTotalRaw: number;
  };
}

export interface PeopleMapRow {
  rank: number;
  name: string;
  privacyName: string;
  amount: string;
  amountRaw: number;
  share: number;
  /** "friend" / "family" / "casual" — for renderer chips. */
  roleLabel: string;
}

export interface PeopleMapCard extends CardBase {
  cardType: "peopleMap";
  data: {
    rows: PeopleMapRow[];
    totalToPeople: string;
    totalToPeopleRaw: number;
  };
}

export interface BiggestDayCard extends CardBase {
  cardType: "biggestDay";
  data: {
    date: string;
    amount: string;
    count: number;
    summary: string;
  };
}

export interface PunchlineCard extends CardBase {
  cardType: "punchline";
  data: {
    line: string;
  };
}

export interface StatsCard extends CardBase {
  cardType: "stats";
  data: {
    rows: { label: string; value: string }[];
  };
}

// Conditional cards
export interface TravelCard extends CardBase {
  cardType: "travel";
  data: { destinations: string[]; amount: string };
}
export interface GenerosityCard extends CardBase {
  cardType: "generosity";
  data: { sent: string; received: string; netSent: string; recipientCount: number };
}
export interface RecoveryCard extends CardBase {
  cardType: "recovery";
  data: { lowPoints: number; comebacks: number };
}
export interface TransportCard extends CardBase {
  cardType: "transport";
  data: { amount: string; rideCount: number; topService: string | null };
}
export interface InternationalCard extends CardBase {
  cardType: "international";
  data: {
    amount: string;
    count: number;
    topSource: string | null;
    /** "inbound" — money received from abroad. We don't currently track outbound here. */
    direction: "inbound";
  };
}

export type ReflectCard =
  | HeadlineCard
  | TopRecipientCard
  | TopMerchantCard
  | LateNightCard
  | FulizaCard
  | SubscriptionsCard
  | BillsMapCard
  | PeopleMapCard
  | BiggestDayCard
  | PunchlineCard
  | StatsCard
  | TravelCard
  | GenerosityCard
  | RecoveryCard
  | TransportCard
  | InternationalCard;

// =============================================================================
// Helpers
// =============================================================================

function compactKES(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  if (abs >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `KES ${Math.round(amount / 1_000)}K`;
  if (abs >= 1_000) return `KES ${(amount / 1_000).toFixed(1)}K`;
  return `KES ${Math.round(amount).toLocaleString()}`;
}

function fullKES(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString()}`;
}

function toInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /[a-zA-Z]/.test(s));
  if (parts.length === 0) return "?";
  return parts.slice(0, 3).map((p) => `${p[0]?.toUpperCase()}.`).join("");
}

function firstName(name: string): string {
  const trimmed = name.trim().split(/\s+/)[0] || name;
  return trimmed
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMpesa\b/i, "M-Pesa");
}

function makePicker(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return <T,>(pool: T[]): T => pool[h % pool.length];
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function weekday(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-KE", { weekday: "long" });
}

/** Pretty label for a relationship — used in card chips. */
function relationshipLabel(r: RecipientRelationship | undefined): string {
  switch (r) {
    case "rent":
      return "rent / regular bill";
    case "staff":
      return "household";
    case "family":
      return "family";
    case "friend":
      return "friend";
    case "casual":
      return "contact";
    case "savings":
      return "savings";
    default:
      return "contact";
  }
}

/**
 * Decide whether a recipient should appear on the Bills card vs the People
 * card. Rent and staff are bills (recurring household obligations), friends
 * and family are people. Casual/unknown skews people.
 */
function isBillRecipient(p: PersonSendSummary): boolean {
  return p.relationship === "rent" || p.relationship === "staff";
}

function isPeopleRecipient(p: PersonSendSummary): boolean {
  return (
    p.relationship === "friend" ||
    p.relationship === "family" ||
    p.relationship === "casual" ||
    !p.relationship
  );
}

// =============================================================================
// Tagline pools — keyed by relationship where relevant. Pools are deliberately
// small and dry. Future work: route through an LLM with the same relationship
// label as a hard constraint.
// =============================================================================

const TAGLINES = {
  headline: [
    "That's a lot of Java.",
    "Where did it go? You're about to find out.",
    "Wapi pesa? Hii ndio jibu.",
    "A year, in shillings.",
    "Numbers don't lie.",
    "You moved real money.",
  ],
  /**
   * Per-relationship tagline pools for the Top Recipient card.
   * Never assume a relationship that hasn't been classified.
   */
  topRecipient: {
    rent: [
      "The household runs on this.",
      "The biggest standing order of your year.",
      "Same number, same date, every month.",
    ],
    staff: [
      "Quietly the most reliable line on your statement.",
      "Salary day, every month, no excuses.",
      "Nyumba inakimbia kwa hii pesa.",
    ],
    family: [
      "Family doesn't ask. Family receives.",
      "The number you don't decline.",
      "Mum / sis / cuz — you know who.",
    ],
    friend: {
      high: [
        "They owe you a meal. Maybe two.",
        "Closest financial friendship of your year.",
        "Anaijua hii pesa.",
      ],
      mid: [
        "They owe you a coffee.",
        "First place is suspicious.",
        "Loyal customer of one.",
      ],
      low: [
        "Small but consistent.",
        "Adds up.",
        "Familiar face on your statement.",
      ],
    },
    casual: [
      "One-off, but it landed.",
      "Once. But for a lot.",
      "An outlier with a name.",
    ],
    unknown: [
      "Familiar face on your statement.",
      "Top of the list, regardless.",
    ],
  },
  topMerchant: [
    "You really do live here.",
    "They should give you a stake.",
    "Loyal.",
    "They know your order by now.",
    "Repeat customer of the year.",
  ],
  lateNight: {
    chaotic: ["Bro.", "We won't tell.", "Vibes were immaculate."],
    mild: [
      "Some of these were probably worth it.",
      "Late-night you has expensive taste.",
      "Hii ni saa ya kuamua.",
    ],
  },
  fuliza: [
    "You and Safaricom have a relationship.",
    "Fuliza imekuokoa, na imekutoza.",
    "It's giving … recurring.",
    "Saves the day. For a fee.",
    "Kuna time hutaki kuongea na ATM.",
  ],
  subscriptions: [
    "When was the last time you used all of these?",
    "Cancel one. We dare you.",
    "Netflix, Spotify, na bado.",
    "Auto-renew should be a horror genre.",
    "These add up faster than you think.",
  ],
  /** Bills card — recurring household obligations, not friends. */
  billsMap: [
    "The line items that don't ask.",
    "These don't take a month off.",
    "The grown-up section of your statement.",
    "Auto-pay would be honest, at this point.",
  ],
  /** People card — actual humans. */
  peopleMap: [
    "The names that recur.",
    "Your inner circle, by the numbers.",
    "Friends, family, and the chat group.",
    "The list that knows.",
  ],
  biggestDay: [
    "Iconic.",
    "We hope it was worth it.",
    "Hii siku tulilewa.",
    "A year-defining moment.",
  ],
  punchline: [
    "Twelve months. One statement.",
    "You spent. You sent. You survived.",
    "Numbers tell the truth even when nobody asks.",
  ],
  travel: [
    "Mileage was earned in matatus.",
    "Saa ingine, nje ya nchi.",
    "Distance covered, money spent.",
  ],
  generosity: [
    "More money out than back.",
    "The bank of you is open.",
    "Your circle eats well.",
  ],
  recovery: [
    "You hit zero. You came back.",
    "Falling and getting up. Repeatedly.",
    "Ana drama financial yake.",
  ],
  transport: [
    "Hours of your life in someone else's car.",
    "Uber owes you a Christmas card.",
    "Boda na Bolt. Such is life.",
  ],
  international: {
    /** Inbound — money arriving from abroad. */
    inbound: [
      "Someone overseas believes in you.",
      "The diaspora pulled through.",
      "Gratitude, in dollars.",
      "Long-distance support, line by line.",
    ],
  },
};

// =============================================================================
// Builder
// =============================================================================

export function buildReflectCards(
  analytics: AnalyticsResult,
  opts: { privacyMode?: boolean } = {}
): ReflectCard[] {
  const privacy = !!opts.privacyMode;
  const pick = makePicker(
    `${analytics.transactionCount}|${Math.round(analytics.totalOutflows)}|${Math.round(analytics.totalInflows)}`
  );
  const cards: Omit<ReflectCard, "index" | "total">[] = [];

  // 1. Headline — total moved
  const totalMoved = analytics.totalInflows + analytics.totalOutflows;
  const netFlow = analytics.netFlow;
  cards.push({
    id: "headline",
    cardType: "headline",
    accent: "white",
    headline: `${compactKES(totalMoved)} moved this year`,
    body: `${analytics.transactionCount.toLocaleString()} transactions in total.`,
    tagline: pick(TAGLINES.headline),
    data: {
      bigNumber: compactKES(totalMoved),
      bigNumberRaw: totalMoved,
      subtitle: "moved through your M-Pesa",
      txCount: `${analytics.transactionCount.toLocaleString()} transactions`,
      netLabel: `Net: ${netFlow >= 0 ? "+" : "−"}${compactKES(Math.abs(netFlow))}`,
      netPositive: netFlow >= 0,
    },
  });

  // 2. Top recipient — biggest single counterparty (person preferred)
  const topPerson = analytics.personToPersonSends[0];
  if (topPerson) {
    const rel = topPerson.relationship ?? "unknown";
    const tagline = pickTopRecipientTagline(rel, topPerson.totalSent, pick);
    const accent: AccentKey =
      rel === "rent" || rel === "staff"
        ? "teal" // bills feel different from friends
        : rel === "family"
          ? "purple"
          : "coral";

    cards.push({
      id: "top-recipient",
      cardType: "topRecipient",
      accent,
      headline: `Your top recipient: ${firstName(topPerson.nameOrInitial)}`,
      body: `${fullKES(topPerson.totalSent)} across ${topPerson.frequency} sends.`,
      tagline,
      data: {
        eyebrow: topRecipientEyebrow(rel),
        name: privacy ? toInitials(topPerson.nameOrInitial) : firstName(topPerson.nameOrInitial),
        fullName: topPerson.nameOrInitial,
        privacyName: toInitials(topPerson.nameOrInitial),
        amount: compactKES(topPerson.totalSent),
        amountRaw: topPerson.totalSent,
        frequency: `across ${topPerson.frequency} ${topPerson.frequency === 1 ? "send" : "sends"}`,
        avgPerSend: `${compactKES(topPerson.totalSent / Math.max(topPerson.frequency, 1))} per send`,
        relationship: rel,
        relationshipLabel: relationshipLabel(rel),
      },
    });
  }

  // 3. Top merchant — biggest non-person counterparty
  const topMerchant = pickTopMerchant(analytics.topCounterpartiesByAmount);
  if (topMerchant) {
    const avg = topMerchant.totalAmount / Math.max(topMerchant.frequency, 1);
    cards.push({
      id: "top-merchant",
      cardType: "topMerchant",
      accent: "teal",
      headline: `Your favorite spot: ${titleCase(topMerchant.name)}`,
      body: `${fullKES(topMerchant.totalAmount)} across ${topMerchant.frequency} visits — about ${fullKES(avg)} per visit.`,
      tagline: pick(TAGLINES.topMerchant),
      data: {
        eyebrow: "Your favorite spot",
        merchant: titleCase(topMerchant.name),
        amount: compactKES(topMerchant.totalAmount),
        amountRaw: topMerchant.totalAmount,
        visits: topMerchant.frequency,
        avgPerVisit: `${compactKES(avg)} per visit`,
      },
    });
  }

  // 4. Late night — 11pm-4am activity
  const ln = analytics.timePatterns.lateNightTransactions;
  if (ln.count > 0) {
    const tone = ln.count >= 30 || ln.total > 50_000 ? "chaotic" : "mild";
    cards.push({
      id: "late-night",
      cardType: "lateNight",
      accent: "purple",
      headline: `${ln.count} transactions after 11pm`,
      body: `Between 11pm and 4am, you moved ${fullKES(ln.total)}.`,
      tagline: pick(TAGLINES.lateNight[tone]),
      data: {
        bigNumber: String(ln.count),
        bigLabel: "transactions after 11pm",
        amount: compactKES(ln.total),
        count: ln.count,
        hourly: analytics.timePatterns.hourlyDistribution.slice(0, 24),
      },
    });
  }

  // 5. Fuliza — overdraft usage
  const fuliza = analytics.mobileLoanActivity.lenders.find((l) => /fuliza/i.test(l.name));
  if (fuliza && fuliza.transactions > 0) {
    cards.push({
      id: "fuliza",
      cardType: "fuliza",
      accent: "amber",
      headline: `Fuliza, our friend`,
      body: `${fuliza.transactions} events · ${fullKES(fuliza.fees)} in fees.`,
      tagline: pick(TAGLINES.fuliza),
      data: {
        eventCount: fuliza.transactions,
        feesPaid: compactKES(fuliza.fees),
        feesPaidRaw: fuliza.fees,
        busiestMonth: analytics.streaks.busiestMonth?.month ?? null,
      },
    });
  }

  // 6. Subscriptions — recurring DIGITAL services only.
  // Filter out insurance, government, healthcare, utilities — these are
  // deliberate financial obligations, not "auto-renewals you forgot about".
  // Britam (insurance) was the offending example; this filter keeps it on
  // a different card (or off the deck entirely).
  const filteredSubs = analytics.subscriptions.filter(
    (s) => !isExcludedSubscription(s)
  );
  if (filteredSubs.length > 0) {
    const sorted = [...filteredSubs].sort((a, b) => b.monthlyCost - a.monthlyCost);
    const monthly = sorted.reduce((s: number, x: Subscription) => s + x.monthlyCost, 0);
    const annual = monthly * 12;
    cards.push({
      id: "subscriptions",
      cardType: "subscriptions",
      accent: "blue",
      headline: `${sorted.length} recurring services`,
      body: `${fullKES(monthly)}/month — about ${fullKES(annual)} a year.`,
      tagline: pick(TAGLINES.subscriptions),
      data: {
        annualTotal: compactKES(annual),
        annualTotalRaw: annual,
        monthlyTotal: compactKES(monthly),
        serviceCount: sorted.length,
        top: sorted.slice(0, 5).map((s) => ({
          name: titleCase(s.name),
          monthly: compactKES(s.monthlyCost),
        })),
      },
    });
  }

  // 7a. Bills card — top recurring obligations (rent, household staff,
  //     bank loan repayments, school fees). Capped at top 5.
  const billsCard = makeBillsMapCard(analytics, privacy, pick);
  if (billsCard) cards.push(billsCard);

  // 7b. People card — top friends/family humans. Excludes anything
  //     classified as rent/staff. Capped at top 5.
  const peopleCard = makePeopleMapCard(analytics, privacy, pick);
  if (peopleCard) cards.push(peopleCard);

  // 8. Biggest day
  const bd = analytics.streaks.busiestDay;
  if (bd && bd.count > 0) {
    const dayDate = new Date(bd.date);
    const summary = makeBiggestDaySummary(bd.count, bd.total);
    cards.push({
      id: "biggest-day",
      cardType: "biggestDay",
      accent: "magenta",
      headline: `${formatDate(dayDate)} — your biggest day`,
      body: `${bd.count} transactions, ${fullKES(bd.total)}.`,
      tagline: pick(TAGLINES.biggestDay).replace(
        "[date]",
        weekday(dayDate) || "that day"
      ),
      data: {
        date: formatDate(dayDate),
        amount: compactKES(bd.total),
        count: bd.count,
        summary,
      },
    });
  }

  // 9. Punchline — relationship-aware data-driven observation
  const punchline = makePunchline(analytics, pick);
  cards.push({
    id: "punchline",
    cardType: "punchline",
    accent: "neutral",
    headline: punchline,
    body: "",
    tagline: "— Wapi Pesa",
    data: { line: punchline },
  });

  // 10. Stats — receipt
  cards.push({
    id: "stats",
    cardType: "stats",
    accent: "multi",
    headline: "Your year by the numbers",
    body: "",
    tagline: "wapipesa.co.ke",
    data: {
      rows: buildStatRows(analytics, privacy),
    },
  });

  // Conditional cards — only when the data warrants
  const transport = makeTransportCard(analytics, pick);
  if (transport) cards.push(transport);

  const intl = makeInternationalCard(analytics, pick);
  if (intl) cards.push(intl);

  const generosity = makeGenerosityCard(analytics, pick);
  if (generosity) cards.push(generosity);

  // Final pass: assign index + total
  const total = cards.length;
  return cards.map((c, i) => ({ ...c, index: i + 1, total } as ReflectCard));
}

// =============================================================================
// Sub-builders
// =============================================================================

function pickTopMerchant(list: CounterpartySummary[]): CounterpartySummary | null {
  for (const c of list) {
    if (c.paybill || c.till) return c;
  }
  return list[1] ?? null;
}

/**
 * Tagline picker for the Top Recipient card. Routed by relationship label.
 * For friends, we further bucket by amount tier. Rent/staff/family pools
 * never see a "they owe you a meal" line.
 */
function pickTopRecipientTagline(
  rel: RecipientRelationship,
  totalSent: number,
  pick: <T>(pool: T[]) => T
): string {
  const pools = TAGLINES.topRecipient;
  switch (rel) {
    case "rent":
      return pick(pools.rent);
    case "staff":
      return pick(pools.staff);
    case "family":
      return pick(pools.family);
    case "casual":
      return pick(pools.casual);
    case "savings":
      return pick(pools.unknown);
    case "friend": {
      const tier =
        totalSent > 100_000 ? "high" : totalSent > 20_000 ? "mid" : "low";
      return pick(pools.friend[tier]);
    }
    default:
      return pick(pools.unknown);
  }
}

function topRecipientEyebrow(rel: RecipientRelationship): string {
  switch (rel) {
    case "rent":
      return "Your biggest standing line";
    case "staff":
      return "Your most consistent recipient";
    case "family":
      return "The family line";
    case "friend":
      return "Your top recipient";
    default:
      return "Your top recipient";
  }
}

function makeBiggestDaySummary(count: number, total: number): string {
  if (count >= 15) return `${count} transactions in 24 hours`;
  if (count >= 8) return `Heavy day — ${count} swipes, taps, and sends`;
  if (count >= 4) return `${count} transactions, one wallet, no chill`;
  return `${count} transactions worth ${compactKES(total)}`;
}

/**
 * Punchline — relationship-aware. We deliberately avoid the "Sent X to NAME,
 * hope they're doing well" template when the recipient is rent/staff/family,
 * because it implies friendship and lands wrong.
 */
function makePunchline(
  a: AnalyticsResult,
  pick: <T>(pool: T[]) => T
): string {
  const top = a.personToPersonSends[0];

  if (top && top.totalSent > 50_000) {
    const rel = top.relationship ?? "unknown";
    const name = firstName(top.nameOrInitial);
    if (rel === "rent") {
      return `${compactKES(top.totalSent)} a year of rent. The landlord is doing fine.`;
    }
    if (rel === "staff") {
      return `${compactKES(top.totalSent)} kept your house running. Worth every shilling.`;
    }
    if (rel === "family") {
      return `${compactKES(top.totalSent)} flowed to ${name}. Family taxes, paid in full.`;
    }
    if (rel === "friend") {
      return `Sent ${compactKES(top.totalSent)} to ${name}. Hope they're doing well.`;
    }
    // Unknown / casual — keep it neutral, avoid friendship framing.
    return `${compactKES(top.totalSent)} went to one number this year. You know which.`;
  }

  const merchant = a.topCounterpartiesByAmount.find((c) => c.paybill || c.till);
  if (merchant && merchant.totalAmount > 100_000) {
    return `${titleCase(merchant.name)} should give you equity at this point.`;
  }
  if (a.subscriptions.length >= 5) {
    return `${a.subscriptions.length} subscriptions running. Cancel one. We dare you.`;
  }
  const fuliza = a.mobileLoanActivity.lenders.find((l) => /fuliza/i.test(l.name));
  if (fuliza && fuliza.transactions > 30) {
    return `Twelve months of M-Pesa. One Fuliza addiction.`;
  }
  if (
    a.timePatterns.lateNightTransactions.total > a.dataAndAirtime.totalDataSpend &&
    a.dataAndAirtime.totalDataSpend > 0
  ) {
    return `Your nights out cost more than your data bundles. Priorities.`;
  }
  if (a.netFlow < -50_000) {
    return `More money out than in. We know.`;
  }
  return pick(TAGLINES.punchline);
}

function buildStatRows(a: AnalyticsResult, privacy: boolean): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  rows.push({ label: "Transactions", value: a.transactionCount.toLocaleString() });
  if (a.streaks.busiestMonth?.month) {
    rows.push({ label: "Busiest month", value: a.streaks.busiestMonth.month });
  }
  if (a.streaks.quietestMonth?.month) {
    rows.push({ label: "Quietest month", value: a.streaks.quietestMonth.month });
  }
  rows.push({
    label: "Longest streak",
    value: `${a.streaks.longestConsecutiveDays} ${a.streaks.longestConsecutiveDays === 1 ? "day" : "days"}`,
  });
  const merchant = a.topCounterpartiesByAmount.find((c) => c.paybill || c.till);
  if (merchant) {
    rows.push({ label: "Top merchant", value: titleCase(merchant.name) });
  }
  // Show top friend (not rent/staff) here — the "most-sent contact" should
  // be a person you'd actually call a contact, not your landlord.
  const sentTo = a.personToPersonSends.find(
    (p) => p.relationship !== "rent" && p.relationship !== "staff"
  );
  if (sentTo) {
    rows.push({
      label: "Most-sent person",
      value: privacy ? toInitials(sentTo.nameOrInitial) : firstName(sentTo.nameOrInitial),
    });
  }
  if (a.feesBreakdown.totalFees > 0) {
    rows.push({ label: "Fees paid", value: compactKES(a.feesBreakdown.totalFees) });
  }
  if (a.timePatterns.lateNightTransactions.count > 0) {
    rows.push({
      label: "Late-night txns",
      value: a.timePatterns.lateNightTransactions.count.toLocaleString(),
    });
  }
  return rows.slice(0, 8);
}

// -----------------------------------------------------------------------------
// Bills + People split — the old Send-Money Map muddled them together.
// -----------------------------------------------------------------------------

function makeBillsMapCard(
  a: AnalyticsResult,
  privacy: boolean,
  pick: <T>(pool: T[]) => T
): Omit<BillsMapCard, "index" | "total"> | null {
  const bills = a.personToPersonSends.filter(isBillRecipient).slice(0, 5);
  if (bills.length < 2) return null;
  const total = bills.reduce((s, p) => s + p.totalSent, 0);
  if (total < 30_000) return null;
  const max = bills[0]?.totalSent || 1;

  const rows: BillsMapRow[] = bills.map((p, i) => ({
    rank: i + 1,
    name: privacy ? toInitials(p.nameOrInitial) : firstName(p.nameOrInitial),
    privacyName: toInitials(p.nameOrInitial),
    amount: compactKES(p.totalSent),
    amountRaw: p.totalSent,
    share: p.totalSent / max,
    roleLabel: relationshipLabel(p.relationship),
  }));

  return {
    id: "bills-map",
    cardType: "billsMap",
    accent: "teal",
    headline: "The bills that don't ask",
    body: rows
      .map((r) => `${r.rank}. ${r.name} — ${r.amount} (${r.roleLabel})`)
      .join(" · "),
    tagline: pick(TAGLINES.billsMap),
    data: {
      rows,
      annualTotal: compactKES(total),
      annualTotalRaw: total,
    },
  };
}

function makePeopleMapCard(
  a: AnalyticsResult,
  privacy: boolean,
  pick: <T>(pool: T[]) => T
): Omit<PeopleMapCard, "index" | "total"> | null {
  const people = a.personToPersonSends.filter(isPeopleRecipient).slice(0, 5);
  if (people.length < 3) return null;
  const totalToPeople = people.reduce((s, p) => s + p.totalSent, 0);
  if (totalToPeople < 10_000) return null;
  const max = people[0]?.totalSent || 1;

  const rows: PeopleMapRow[] = people.map((p, i) => ({
    rank: i + 1,
    name: privacy ? toInitials(p.nameOrInitial) : firstName(p.nameOrInitial),
    privacyName: toInitials(p.nameOrInitial),
    amount: compactKES(p.totalSent),
    amountRaw: p.totalSent,
    share: p.totalSent / max,
    roleLabel: relationshipLabel(p.relationship),
  }));

  return {
    id: "people-map",
    cardType: "peopleMap",
    accent: "gold",
    headline: "The people who got paid",
    body: rows.map((r) => `${r.rank}. ${r.name} — ${r.amount}`).join(" · "),
    tagline: pick(TAGLINES.peopleMap),
    data: {
      rows,
      totalToPeople: compactKES(totalToPeople),
      totalToPeopleRaw: totalToPeople,
    },
  };
}

// -----------------------------------------------------------------------------
// Conditional cards
// -----------------------------------------------------------------------------

function makeTransportCard(
  a: AnalyticsResult,
  pick: <T>(pool: T[]) => T
): Omit<TransportCard, "index" | "total"> | null {
  const list = a.topCounterpartiesByAmount.filter((c) =>
    /uber|bolt|little|swvl|matatu|safe ?boda|faras|yego/i.test(c.name)
  );
  if (list.length === 0) return null;
  const total = list.reduce((s, c) => s + c.totalAmount, 0);
  const rides = list.reduce((s, c) => s + c.frequency, 0);
  if (total < 5_000 || rides < 5) return null;
  const top = list.sort((a, b) => b.totalAmount - a.totalAmount)[0];
  return {
    id: "transport",
    cardType: "transport",
    accent: "teal",
    headline: `${fullKES(total)} on rides`,
    body: `${rides} rides this year. Top service: ${titleCase(top.name)}.`,
    tagline: pick(TAGLINES.transport),
    data: {
      amount: compactKES(total),
      rideCount: rides,
      topService: titleCase(top.name),
    },
  };
}

function makeInternationalCard(
  a: AnalyticsResult,
  pick: <T>(pool: T[]) => T
): Omit<InternationalCard, "index" | "total"> | null {
  const intl = a.internationalTransfers;
  // Only fire when the inbound flow is meaningful — we don't want this card
  // to appear for someone with one tiny KES 200 receipt from abroad.
  if (!intl || intl.transferCount < 2 || intl.totalReceived < 20_000) return null;
  const top = intl.sources.sort((x, y) => y.total - x.total)[0];
  return {
    id: "international",
    cardType: "international",
    accent: "blue",
    headline: `${fullKES(intl.totalReceived)} arrived from abroad`,
    body: `${intl.transferCount} international transfers this year.`,
    tagline: pick(TAGLINES.international.inbound),
    data: {
      amount: compactKES(intl.totalReceived),
      count: intl.transferCount,
      topSource: top ? titleCase(top.name) : null,
      direction: "inbound",
    },
  };
}

/**
 * Generosity — only fires when the user's outbound to *non-bill* people is
 * substantial relative to inflows. Rent and staff are payments, not gifts;
 * counting them as generosity makes the framing dishonest.
 */
function makeGenerosityCard(
  a: AnalyticsResult,
  pick: <T>(pool: T[]) => T
): Omit<GenerosityCard, "index" | "total"> | null {
  const trueRecipients = a.personToPersonSends.filter(isPeopleRecipient);
  if (trueRecipients.length < 3) return null;
  const totalSent = trueRecipients.reduce((s, p) => s + p.totalSent, 0);
  if (totalSent < a.totalInflows * 0.2) return null;
  if (totalSent < 30_000) return null;
  return {
    id: "generosity",
    cardType: "generosity",
    accent: "purple",
    headline: `${fullKES(totalSent)} sent to friends and family`,
    body: `Across ${trueRecipients.length} different people.`,
    tagline: pick(TAGLINES.generosity),
    data: {
      sent: compactKES(totalSent),
      received: compactKES(a.totalInflows),
      netSent: compactKES(totalSent),
      recipientCount: trueRecipients.length,
    },
  };
}

// -----------------------------------------------------------------------------
// Subscriptions filter — exclude obligations dressed up as subscriptions.
// -----------------------------------------------------------------------------

const EXCLUDED_SUB_CATEGORIES = new Set([
  "insurance",     // Britam, AAR, Jubilee, NSSF, MMFs — financial products
  "utilities",     // KPLC, water, fibre — necessary household bills
  "government",    // KRA, eCitizen, NTSA
  "healthcare",    // hospital paybills
  "banking",       // loan repayments, M-Shwari etc.
]);

function isExcludedSubscription(s: Subscription): boolean {
  if (s.category && EXCLUDED_SUB_CATEGORIES.has(s.category)) return true;
  // Catch-all by name: insurance, SACCOs, M-Pesa fees, recurring supermarket
  // visits — none of these are "subscriptions you forgot you pay for".
  if (
    /britam|jubilee|sanlam|insurance|assurance|nssf|nhif|cic|icea|sacco|chama|money\s*market|asset\s*manag|overdraw|overdraft|fuliza|naivas|carrefour|chandarana|tuskys|quickmart|tuskys/i.test(
      s.name
    )
  ) {
    return true;
  }
  return false;
}
