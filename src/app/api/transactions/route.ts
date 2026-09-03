import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { categorize } from "@/lib/registry/categorize";
import { CATEGORIES, type Category } from "@/lib/registry/categories";
import { contactKey, isSelfTransfer, maskForDisplay } from "@/lib/parser/identity";
import type { Transaction } from "@/lib/parser/types";
import { canAccessPaidReport } from "@/lib/runtime-features";

/**
 * Filtered transaction list for client-side search, drill-down panels, and the
 * upcoming CSV export. Lives entirely off the in-memory parsed statement —
 * never touches a database.
 *
 * Query parameters (all optional):
 *   - sessionId   — required
 *   - from, to    — ISO timestamps to clip the period
 *   - search      — free-text query (matches name, description, paybill, amount)
 *   - category    — display label (e.g. "Subscriptions") or canonical key
 *   - direction   — "in" | "out"
 *   - contactKey  — composite "n:NAME|p:PHONE" produced by `contactKey()`
 *   - paybill     — paybill number
 *   - till        — till number
 *   - merchant    — GlobalPay merchant name (matches the canonical merchant)
 *   - limit       — page size, default 100, max 500
 *   - offset      — pagination offset
 *   - includeAggregates — "true" returns count + total in addition to rows
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sessionId = params.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }
  if (!canAccessPaidReport(session.status)) {
    return NextResponse.json(
      { error: "Payment confirmation is required before transaction access." },
      { status: 402 }
    );
  }
  if (!session.parsedStatement) {
    return NextResponse.json({ error: "No parsed statement in session" }, { status: 400 });
  }

  const filter: TransactionFilter = {
    from: parseDate(params.get("from")),
    to: parseDate(params.get("to")),
    search: nonEmpty(params.get("search")),
    category: nonEmpty(params.get("category")),
    direction: nonEmpty(params.get("direction")) as TransactionFilter["direction"],
    contact: nonEmpty(params.get("contactKey")),
    paybill: nonEmpty(params.get("paybill")),
    till: nonEmpty(params.get("till")),
    merchant: nonEmpty(params.get("merchant")),
  };

  const limit = clamp(parseIntOr(params.get("limit"), 100), 1, 500);
  const offset = Math.max(0, parseIntOr(params.get("offset"), 0));
  const includeAggregates = params.get("includeAggregates") === "true";

  const ownerPhone = session.parsedStatement.phoneNumber;
  const accountHolder = session.parsedStatement.accountHolder;

  const isSelf = (tx: Transaction) =>
    isSelfTransfer({
      counterpartyPhone: tx.counterparty.phoneNumber,
      counterpartyName: tx.counterparty.name,
      ownerPhone,
      accountHolder,
    });

  const all = session.parsedStatement.transactions
    .filter((t) => t.status === "Completed")
    .filter((t) => matches(t, filter, { ownerPhone, accountHolder }));

  // newest-first ordering for transaction lists
  all.sort((a, b) => new Date(b.completionTime).getTime() - new Date(a.completionTime).getTime());

  const page = all.slice(offset, offset + limit).map((t) => serialize(t, isSelf));
  let aggregates: { totalIn: number; totalOut: number; count: number } | undefined;
  if (includeAggregates) {
    aggregates = {
      totalIn: all.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0),
      totalOut: all.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0),
      count: all.length,
    };
  }

  return NextResponse.json({
    transactions: page,
    total: all.length,
    offset,
    limit,
    ...(aggregates ? { aggregates } : {}),
  });
}

// =============================================================================
// helpers
// =============================================================================

interface TransactionFilter {
  from: Date | null;
  to: Date | null;
  search: string | null;
  category: string | null;
  direction: "in" | "out" | null;
  contact: string | null;
  paybill: string | null;
  till: string | null;
  merchant: string | null;
}

function matches(
  t: Transaction,
  f: TransactionFilter,
  ctx: { ownerPhone: string | null; accountHolder: string | null }
): boolean {
  const ts = new Date(t.completionTime).getTime();
  if (f.from && ts < f.from.getTime()) return false;
  if (f.to && ts > f.to.getTime()) return false;
  if (f.direction && t.direction !== f.direction) return false;

  if (f.paybill && (t.counterparty.paybillNumber || "") !== f.paybill) return false;
  if (f.till && (t.counterparty.tillNumber || "") !== f.till) return false;

  if (f.contact) {
    // Cards may pass either the raw key (built from the underlying phone) or
    // the display-form key (built from the masked-for-display phone shown in
    // the UI). Accept either so click-throughs always work.
    const phone = t.counterparty.phoneNumber || "";
    const k1 = contactKey(t.counterparty.name, phone);
    const k2 = contactKey(t.counterparty.name, phone ? maskForDisplay(phone) : null);
    if (k1 !== f.contact && k2 !== f.contact) return false;
  }

  if (f.category) {
    const wantKey = canonicalCategoryKey(f.category);
    const isSelf = (tx: Transaction) =>
      isSelfTransfer({
        counterpartyPhone: tx.counterparty.phoneNumber,
        counterpartyName: tx.counterparty.name,
        ownerPhone: ctx.ownerPhone,
        accountHolder: ctx.accountHolder,
      });
    const got = categorize(t, isSelf).category;
    if (got !== wantKey) return false;
  }

  if (f.merchant) {
    const want = f.merchant.toLowerCase();
    const cpName = (t.counterparty.name || "").toLowerCase();
    if (!cpName.includes(want) && !t.details.toLowerCase().includes(want)) return false;
  }

  if (f.search) {
    const q = f.search.toLowerCase();
    if (!searchHits(t, q)) return false;
  }

  return true;
}

function searchHits(t: Transaction, q: string): boolean {
  if ((t.counterparty.name || "").toLowerCase().includes(q)) return true;
  if (t.details.toLowerCase().includes(q)) return true;
  if (t.receiptNo.toLowerCase().includes(q)) return true;
  if ((t.counterparty.paybillNumber || "").includes(q)) return true;
  if ((t.counterparty.tillNumber || "").includes(q)) return true;
  // numeric query: match on amount within a small band
  const num = Number(q.replace(/[, ]/g, ""));
  if (!Number.isNaN(num) && num > 0) {
    const tolerance = Math.max(1, num * 0.005);
    if (Math.abs(t.amount - num) <= tolerance) return true;
  }
  return false;
}

function serialize(t: Transaction, isSelf: (tx: Transaction) => boolean) {
  return {
    receiptNo: t.receiptNo,
    completionTime: t.completionTime,
    details: t.details,
    amount: t.amount,
    fee: t.fee,
    direction: t.direction,
    type: t.type,
    balance: t.balance,
    detectedCategoryKey: categorize(t, isSelf).category,
    counterparty: {
      name: t.counterparty.name,
      maskedPhone: t.counterparty.phoneNumber
        ? maskForDisplay(t.counterparty.phoneNumber)
        : null,
      paybill: t.counterparty.paybillNumber,
      till: t.counterparty.tillNumber,
    },
  };
}

function canonicalCategoryKey(input: string): string {
  // Accept either a display label ("Subscriptions") or the canonical key
  // ("subscriptions"). The categorizer always returns canonical keys.
  if (input in CATEGORIES) return input;
  for (const [k, v] of Object.entries(CATEGORIES) as [Category, string][]) {
    if (v.toLowerCase() === input.toLowerCase()) return k;
  }
  return input;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIntOr(s: string | null, fallback: number): number {
  if (!s) return fallback;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? fallback : n;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function nonEmpty(s: string | null): string | null {
  return s && s.trim().length > 0 ? s.trim() : null;
}
