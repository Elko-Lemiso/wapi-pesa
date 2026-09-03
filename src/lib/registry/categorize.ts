import type { Transaction } from "../parser/types";
import type { Category } from "./categories";
import { lookupPaybill, lookupTill } from "./paybills";
import { lookupGlobalPayMerchant } from "./globalpay-merchants";

/**
 * Layered classification pipeline. Each transaction lands in exactly one
 * category from the consolidated 14-category taxonomy in `./categories.ts`.
 *
 * Order of evaluation (first hit wins):
 *
 *   Layer 0: Self-transfer (caller-supplied predicate)
 *   Layer 1: Paybill registry (most paybills resolve here)
 *   Layer 2: GlobalPay merchant registry (paybill 903470 only)
 *   Layer 3: Description keyword matching (airtime, agents, intl, OD)
 *   Layer 4: Transaction-type defaults (send_money → personal, etc.)
 *   Layer 5: Pattern-based P2P (rideshare amounts, recurring weekly P2P, …)
 *   Layer 6: Fallback "uncategorized"
 *
 * Returns `{ category, confidence, source }` so the UI can show a "?" qualifier
 * on low-confidence guesses (Layer 5+).
 */

export type Confidence = "high" | "medium" | "low";

export interface CategorizationResult {
  category: Category;
  confidence: Confidence;
  source: "self" | "paybill" | "globalpay" | "keyword" | "type" | "pattern" | "fallback";
}

export function categorize(t: Transaction, isSelf?: (t: Transaction) => boolean): CategorizationResult {
  // ============ Layer 0: self-transfer ============
  if (isSelf && isSelf(t)) {
    return { category: "self_transfer", confidence: "high", source: "self" };
  }

  // ============ Layer 1: paybill registry ============
  const paybill = t.counterparty.paybillNumber;
  if (paybill && paybill !== "903470") {
    const entry = lookupPaybill(paybill);
    if (entry) {
      return { category: entry.category, confidence: "high", source: "paybill" };
    }
  }

  // ============ Layer 2: GlobalPay merchant ============
  if (paybill === "903470" && t.counterparty.name) {
    const hit = lookupGlobalPayMerchant(t.counterparty.name);
    if (hit) {
      return { category: hit.category, confidence: "high", source: "globalpay" };
    }
    // Unknown GlobalPay merchant — still a card subscription/shopping bucket
    return { category: "subscriptions", confidence: "medium", source: "globalpay" };
  }

  // ============ Layer 1 (cont.): till registry ============
  if (t.counterparty.tillNumber) {
    const entry = lookupTill(t.counterparty.tillNumber);
    if (entry) {
      return { category: entry.category, confidence: "high", source: "paybill" };
    }
  }

  // ============ Layer 3: description keyword matching ============
  const upper = (t.details || "").toUpperCase();
  if (upper.includes("SAFARICOM DATA") || upper.includes("BUNDLE") || upper.includes("DATA BUNDLES")) {
    return { category: "utilities", confidence: "high", source: "keyword" };
  }
  if (upper.includes("AIRTIME") || upper.includes("TOP UP") || upper.includes("TOPUP")) {
    return { category: "utilities", confidence: "high", source: "keyword" };
  }
  if (
    upper.includes("OD LOAN REPAYMENT") ||
    upper.includes("OVERDRAFT") ||
    upper.includes("FULIZA")
  ) {
    return { category: "banking", confidence: "high", source: "keyword" };
  }
  if (
    upper.includes("RECEIVE INTERNATIONAL") ||
    upper.includes("REMITLY") ||
    upper.includes("DIGITAL IMTS") ||
    upper.includes("WORLDREMIT") ||
    upper.includes("WISE")
  ) {
    // Inbound international transfers are income, not spending — categorise
    // as personal to keep them out of expense breakdowns.
    return { category: "personal", confidence: "high", source: "keyword" };
  }
  if (upper.includes("WITHDRAW") && (upper.includes("AGENT") || upper.includes("ATM"))) {
    return { category: "banking", confidence: "medium", source: "keyword" };
  }
  if (upper.includes("DEPOSIT") && upper.includes("AGENT")) {
    return { category: "banking", confidence: "medium", source: "keyword" };
  }

  // ============ Layer 4: transaction-type defaults ============
  switch (t.type) {
    case "data_bundle":
    case "airtime":
      return { category: "utilities", confidence: "high", source: "type" };
    case "withdraw_agent":
    case "deposit_agent":
      return { category: "banking", confidence: "medium", source: "type" };
    case "fuliza":
    case "mshwari_deposit":
    case "mshwari_withdrawal":
    case "kcb_mpesa":
    case "od_repayment":
      return { category: "banking", confidence: "high", source: "type" };
    case "international_transfer":
      return { category: "personal", confidence: "high", source: "type" };
    case "globalpay":
      return { category: "subscriptions", confidence: "medium", source: "type" };
    case "salary":
    case "promotion":
    case "receive_money":
      return { category: "personal", confidence: "high", source: "type" };
    case "reversal":
      return { category: "uncategorized", confidence: "low", source: "type" };
    default:
      break;
  }

  // ============ Layer 5: pattern-based P2P (low confidence) ============
  if (t.type === "send_money" && t.counterparty.phoneNumber) {
    const hour = t.completionTime.getHours();
    const isCommuteOrLateNight = hour >= 17 && hour <= 23;
    if (isCommuteOrLateNight && t.amount >= 150 && t.amount <= 2500) {
      // Could plausibly be a rideshare driver who took payment via M-Pesa.
      return { category: "transport", confidence: "low", source: "pattern" };
    }
    return { category: "personal", confidence: "medium", source: "type" };
  }
  if (t.type === "buy_goods") {
    return { category: "shopping", confidence: "medium", source: "type" };
  }
  if (t.type === "pay_bill") {
    return { category: "uncategorized", confidence: "low", source: "fallback" };
  }

  // ============ Layer 6: fallback ============
  return { category: "uncategorized", confidence: "low", source: "fallback" };
}
