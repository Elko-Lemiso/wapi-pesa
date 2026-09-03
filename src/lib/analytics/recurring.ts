import type { Transaction, RecurringPayment, Subscription } from "../parser/types";
import { lookupPaybill, lookupTill } from "../registry/paybills";
import { contactKey, normalizeMerchantName } from "../parser/identity";

interface RecurringOptions {
  /** Predicate used to exclude self-transfers from recurring detection. */
  isSelf?: (t: Transaction) => boolean;
}

export function detectRecurringPayments(
  transactions: Transaction[],
  opts: RecurringOptions = {}
): RecurringPayment[] {
  const outgoing = transactions.filter((t) => t.direction === "out");
  const filtered = opts.isSelf ? outgoing.filter((t) => !opts.isSelf!(t)) : outgoing;

  // Group by recipient identity + amount bucket. The key uses the normalised
  // merchant name when available so that NETFLIX.COM / Netflix Los Gatos /
  // NETFLIX collapse onto one subscription. (Bug 5)
  const groups = new Map<string, Transaction[]>();

  for (const t of filtered) {
    const key = getRecurringKey(t);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const recurring: RecurringPayment[] = [];

  for (const [, txns] of groups) {
    if (txns.length < 2) continue;

    const frequency = detectFrequency(txns);
    if (!frequency) continue;

    const amounts = txns.map((t) => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    // Check for amount consistency (within 20% variance)
    const isConsistent = amounts.every(
      (a) => Math.abs(a - avgAmount) / avgAmount < 0.2
    );
    if (!isConsistent && frequency === "monthly") {
      // For monthly, allow some variance but still flag it
      const stdDev = Math.sqrt(
        amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length
      );
      if (stdDev / avgAmount > 0.5) continue;
    }

    const sample = txns[0];
    const recipientType = sample.counterparty.paybillNumber
      ? "paybill"
      : sample.counterparty.tillNumber
        ? "till"
        : "phone";

    const recipientName = resolveRecipientName(sample);
    const category = resolveRecurringCategory(sample);

    recurring.push({
      recipient: recipientName,
      recipientType,
      amount: Math.round(avgAmount),
      frequency,
      category,
      totalSpent: Math.round(amounts.reduce((a, b) => a + b, 0)),
      occurrences: txns.length,
    });
  }

  return recurring.sort((a, b) => b.totalSpent - a.totalSpent);
}

export function detectSubscriptions(
  transactions: Transaction[],
  opts: RecurringOptions = {}
): Subscription[] {
  const recurring = detectRecurringPayments(transactions, opts);

  // Names of payment aggregators where the M-Pesa description does not reveal
  // the underlying merchant. Each individual reference (e.g. "SAMPLE-REF") is
  // unidentifiable as a discrete subscription, so we omit them entirely.
  const opaqueAggregatorNames = /^(iPay|Pesapal|JamboPay)\b/i;

  return recurring
    .filter((r) => r.recipientType === "paybill" || r.recipientType === "till")
    .filter((r) => r.frequency === "monthly")
    .filter((r) => !opaqueAggregatorNames.test(r.recipient))
    .map((r) => ({
      name: r.recipient,
      paybill: r.recipientType === "paybill" ? r.recipient : null,
      monthlyCost: r.amount,
      totalCost: r.totalSpent,
      isIdentified: !r.recipient.startsWith("Paybill") && !r.recipient.startsWith("Till"),
      category: r.category,
    }));
}

function getRecurringKey(t: Transaction): string | null {
  const amountBucket = Math.round(t.amount / 100) * 100;

  // GlobalPay (903470) — group by canonical merchant name only. We deliberately
  // ignore amount buckets here: a service like Cursor that increases its price
  // mid-period is still ONE subscription, not two. (Bug 5)
  if (t.counterparty.paybillNumber === "903470" && t.counterparty.name) {
    const merchant = normalizeMerchantName(t.counterparty.name);
    if (merchant) return `merchant:${merchant.toUpperCase()}`;
  }

  // Other paybills/tills — group by paybill+merchant. Keep amount bucket for
  // utilities (Kenya Power, Safaricom Home etc.) where each top-up is a
  // distinct purchase rather than a renewing subscription.
  if (t.counterparty.paybillNumber) {
    const merchant = t.counterparty.name ? normalizeMerchantName(t.counterparty.name) : "";
    return `paybill:${t.counterparty.paybillNumber}:${merchant.toUpperCase()}:${amountBucket}`;
  }
  if (t.counterparty.tillNumber) {
    return `till:${t.counterparty.tillNumber}:${amountBucket}`;
  }

  // Person-to-person: group by composite (name + masked phone) so distinct
  // people aren't merged. (Bug 1 again — recurring detection had the same hole.)
  if (t.counterparty.phoneNumber) {
    return `${contactKey(t.counterparty.name, t.counterparty.phoneNumber)}:${amountBucket}`;
  }

  if (t.counterparty.name) return `name:${t.counterparty.name.toUpperCase()}:${amountBucket}`;
  return null;
}

function detectFrequency(
  txns: Transaction[]
): "daily" | "weekly" | "monthly" | null {
  if (txns.length < 2) return null;

  const sorted = [...txns].sort(
    (a, b) => a.completionTime.getTime() - b.completionTime.getTime()
  );

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff =
      (sorted[i].completionTime.getTime() - sorted[i - 1].completionTime.getTime()) /
      (1000 * 60 * 60 * 24);
    gaps.push(diff);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  if (avgGap <= 2 && txns.length >= 5) return "daily";
  if (avgGap >= 5 && avgGap <= 10 && txns.length >= 3) return "weekly";
  if (avgGap >= 25 && avgGap <= 35 && txns.length >= 2) return "monthly";

  // If at least 3 occurrences and gaps are roughly monthly
  if (txns.length >= 3 && avgGap >= 20 && avgGap <= 40) return "monthly";

  return null;
}

function resolveRecipientName(t: Transaction): string {
  if (t.counterparty.name) return t.counterparty.name;
  if (t.counterparty.paybillNumber) {
    const entry = lookupPaybill(t.counterparty.paybillNumber);
    return entry?.name || `Paybill ${t.counterparty.paybillNumber}`;
  }
  if (t.counterparty.tillNumber) {
    const entry = lookupTill(t.counterparty.tillNumber);
    return entry?.name || `Till ${t.counterparty.tillNumber}`;
  }
  if (t.counterparty.phoneNumber) {
    return `Phone ${maskPhone(t.counterparty.phoneNumber)}`;
  }
  return "Unknown Recipient";
}

function resolveRecurringCategory(t: Transaction): string | null {
  if (t.counterparty.paybillNumber) {
    const entry = lookupPaybill(t.counterparty.paybillNumber);
    return entry?.category ?? null;
  }
  if (t.counterparty.tillNumber) {
    const entry = lookupTill(t.counterparty.tillNumber);
    return entry?.category ?? null;
  }
  return null;
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 4)}XX XXX ${phone.slice(-3)}`;
}
