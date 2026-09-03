import type {
  PersonSendSummary,
  RecipientRelationship,
  Transaction,
} from "../parser/types";
import { contactKey, maskForDisplay } from "../parser/identity";

/**
 * Relationship classifier for person-to-person send recipients.
 *
 * Why this exists: a recipient who appears on the user's statement as
 * "Amani, KES 60K every month, 8 months running" is likely to represent the
 * user's *rent* or *live-in staff* — not a friend. The pre-existing card
 * builder treated every top recipient as a friend and slapped friend-shaped
 * taglines on them ("they owe you a meal"). For a real user that's
 * corrosive — the personalisation is wrong by assumption.
 *
 * The classifier looks at four features of the sending pattern and assigns
 * a relationship label:
 *
 *   1. Cadence (monthly / weekly / irregular) — derived from inter-event gaps.
 *   2. Amount stability (coefficient of variation) — rent is rock-stable;
 *      friends are not.
 *   3. Average amount band — rent sits ≥ KES 25K monthly; staff usually
 *      KES 3K–25K monthly; friend sends are typically small and one-off.
 *   4. Reciprocity — a friend sometimes sends money back. Rent and staff
 *      almost never do.
 *
 * The classifier is deliberately conservative: when signals are weak it
 * returns "casual" or "friend" with low confidence rather than guessing
 * "rent" and getting the framing badly wrong on real data.
 */

export interface RelationshipFeatures {
  totalSent: number;
  frequency: number;
  monthsActive: number;
  avgAmount: number;
  amountCV: number;
  cadence: "weekly" | "biweekly" | "monthly" | "irregular";
  receivedBack: number;
}

/**
 * Enrich basic PersonSendSummary entries with relationship classification.
 *
 * Pass the same set of completed transactions used to compute the basic
 * summaries. The enricher matches by (name, masked phone) just like the
 * primitives — no risk of cross-contamination across distinct contacts.
 */
export function enrichPersonSends(
  summaries: PersonSendSummary[],
  transactions: Transaction[]
): PersonSendSummary[] {
  // Index by (name, MASKED phone) so the keys we build here match the keys
  // used in PersonSendSummary, which only carries the masked form. Distinct
  // people whose masked suffixes happen to collide are still kept apart by
  // the full uppercased name half of the key (same logic as primitives.ts).
  const outByKey = new Map<string, Transaction[]>();
  const inByKey = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (!t.counterparty.phoneNumber) continue;
    const key = contactKey(
      t.counterparty.name,
      maskForDisplay(t.counterparty.phoneNumber)
    );
    if (t.direction === "out" && t.type === "send_money") {
      const arr = outByKey.get(key) || [];
      arr.push(t);
      outByKey.set(key, arr);
    } else if (
      t.direction === "in" &&
      (t.type === "receive_money" || t.type === "send_money") // M-Pesa sometimes flags incoming as send_money
    ) {
      const arr = inByKey.get(key) || [];
      arr.push(t);
      inByKey.set(key, arr);
    }
  }

  return summaries.map((summary) => {
    // Summaries with no detected name are stored as "Unknown" — but the
    // transactions for those rows were indexed with name=null. Try the
    // exact key first, then fall back to phone-only for unnamed recipients.
    const primaryKey = contactKey(summary.nameOrInitial, summary.maskedPhone);
    const fallbackKey =
      summary.nameOrInitial === "Unknown"
        ? contactKey(null, summary.maskedPhone)
        : null;
    const outs =
      outByKey.get(primaryKey) ||
      (fallbackKey ? outByKey.get(fallbackKey) || [] : []);
    if (outs.length === 0) return summary;

    const ins =
      inByKey.get(primaryKey) ||
      (fallbackKey ? inByKey.get(fallbackKey) || [] : []);
    const features = extractFeatures(outs, ins);
    const { relationship, confidence, role } = classify(features);

    return {
      ...summary,
      relationship,
      relationshipConfidence: confidence,
      inferredRole: role,
      monthsActive: features.monthsActive,
      amountCV: round(features.amountCV, 3),
      cadence: features.cadence,
      receivedFromSame: Math.round(features.receivedBack),
    };
  });
}

function extractFeatures(
  outs: Transaction[],
  ins: Transaction[]
): RelationshipFeatures {
  const sortedOuts = [...outs].sort(
    (a, b) => a.completionTime.getTime() - b.completionTime.getTime()
  );

  const amounts = sortedOuts.map((t) => t.amount);
  const totalSent = amounts.reduce((s, x) => s + x, 0);
  const frequency = sortedOuts.length;
  const avgAmount = totalSent / frequency;

  const stdDev =
    Math.sqrt(
      amounts.reduce((s, a) => s + (a - avgAmount) ** 2, 0) / frequency
    ) || 0;
  const amountCV = avgAmount > 0 ? stdDev / avgAmount : 0;

  const monthBuckets = new Set<string>();
  for (const t of sortedOuts) {
    monthBuckets.add(
      `${t.completionTime.getFullYear()}-${t.completionTime.getMonth()}`
    );
  }
  const monthsActive = monthBuckets.size;

  const cadence = detectCadence(sortedOuts);

  const receivedBack = ins.reduce((s, t) => s + t.amount, 0);

  return {
    totalSent,
    frequency,
    monthsActive,
    avgAmount,
    amountCV,
    cadence,
    receivedBack,
  };
}

function detectCadence(
  txns: Transaction[]
): "weekly" | "biweekly" | "monthly" | "irregular" {
  if (txns.length < 2) return "irregular";

  const gaps: number[] = [];
  for (let i = 1; i < txns.length; i++) {
    const gap =
      (txns[i].completionTime.getTime() - txns[i - 1].completionTime.getTime()) /
      (1000 * 60 * 60 * 24);
    gaps.push(gap);
  }

  // Use median rather than mean — protects against one big gap (e.g. user
  // travelled, contact went silent for 2 months) corrupting the classification.
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  if (median <= 9) return "weekly";
  if (median <= 18) return "biweekly";
  if (median <= 40) return "monthly";
  return "irregular";
}

function classify(
  f: RelationshipFeatures
): { relationship: RecipientRelationship; confidence: number; role: string } {
  // Reciprocity is a strong signal — money flowing both ways is almost
  // never a rent or staff relationship. Cap on a meaningful absolute amount
  // so a tiny KES 100 reverse send doesn't tilt a clear rent recipient.
  const reciprocityRatio = f.totalSent > 0 ? f.receivedBack / f.totalSent : 0;
  const isReciprocal = reciprocityRatio >= 0.2 && f.receivedBack >= 2_000;

  // RENT — monthly cadence, large amount, fairly stable, multi-month, no
  // reciprocity. CV tolerance is generous (≤ 0.45) because real rent has
  // legitimate jitter: deposits, double-month catch-ups, the occasional
  // partial payment. The monthly cadence + large average + multi-month
  // signature is doing the heavy lifting here.
  if (
    f.cadence === "monthly" &&
    f.avgAmount >= 25_000 &&
    f.amountCV <= 0.45 &&
    f.monthsActive >= 3 &&
    !isReciprocal
  ) {
    return {
      relationship: "rent",
      confidence: f.amountCV <= 0.2 ? 0.92 : 0.78,
      role: "Likely rent or a recurring large bill",
    };
  }

  // STAFF — monthly, mid-band amount, stable, multi-month, no reciprocity.
  // Kenya domestic-worker wage range is ~KES 8K to 35K depending on role.
  if (
    f.cadence === "monthly" &&
    f.avgAmount >= 4_000 &&
    f.avgAmount < 25_000 &&
    f.amountCV <= 0.35 &&
    f.monthsActive >= 3 &&
    !isReciprocal
  ) {
    return {
      relationship: "staff",
      confidence: 0.8,
      role: "Likely household staff or a service provider",
    };
  }

  // STAFF (weekly) — common for casual labour: gardener, cleaner, watchman.
  // Smaller amount, weekly cadence, multi-month, very stable.
  if (
    f.cadence === "weekly" &&
    f.avgAmount >= 500 &&
    f.avgAmount < 8_000 &&
    f.amountCV <= 0.4 &&
    f.frequency >= 8 &&
    !isReciprocal
  ) {
    return {
      relationship: "staff",
      confidence: 0.7,
      role: "Likely a regular weekly worker",
    };
  }

  // FAMILY — recurring across multiple months, varied amount, low reciprocity.
  // The variance is what distinguishes from rent/staff: family sends fluctuate
  // with school fees, emergencies, occasions.
  if (
    f.monthsActive >= 4 &&
    f.amountCV >= 0.35 &&
    !isReciprocal &&
    f.totalSent >= 15_000
  ) {
    return {
      relationship: "family",
      confidence: 0.6,
      role: "Likely family or close circle",
    };
  }

  // FRIEND (reciprocal) — money flows both ways. Strongest friend signal.
  if (isReciprocal && f.frequency >= 2) {
    return {
      relationship: "friend",
      confidence: 0.85,
      role: "Friend (you and they exchange money both ways)",
    };
  }

  // FRIEND (irregular outbound) — a few sends, no clear cadence, smaller amounts.
  if (f.frequency >= 3 && f.cadence === "irregular" && f.avgAmount < 15_000) {
    return {
      relationship: "friend",
      confidence: 0.55,
      role: "Friend or contact",
    };
  }

  // CASUAL — one or two small sends, no real pattern.
  if (f.frequency <= 2 || f.totalSent < 3_000) {
    return {
      relationship: "casual",
      confidence: 0.45,
      role: "One-off contact",
    };
  }

  // Fall through — recurring but not strongly fitting any bucket. Lean
  // friend with low confidence rather than guessing "rent".
  return {
    relationship: "friend",
    confidence: 0.4,
    role: "Recurring contact",
  };
}

function round(n: number, places: number): number {
  const m = Math.pow(10, places);
  return Math.round(n * m) / m;
}
