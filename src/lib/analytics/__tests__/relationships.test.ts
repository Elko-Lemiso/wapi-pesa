/**
 * Tests for the relationship classifier. The cardinal rule: a recurring
 * monthly large recipient (the synthetic "Amani" rent pattern) must never
 * be classified as a friend, and a clearly reciprocal recipient must never
 * be classified as rent or staff.
 *
 * Run:  npx tsx --test src/lib/analytics/__tests__/relationships.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Transaction, PersonSendSummary } from "../../parser/types";
import { enrichPersonSends } from "../relationships";
import { maskForDisplay } from "../../parser/identity";

function txn(opts: {
  date: string;
  amount: number;
  direction: "in" | "out";
  name: string | null;
  phone: string;
}): Transaction {
  return {
    receiptNo: `R-${opts.date}-${opts.amount}`,
    completionTime: new Date(opts.date),
    details: "synthetic",
    status: "Completed",
    amount: opts.amount,
    direction: opts.direction,
    fee: 0,
    overdraftUsed: 0,
    paidIn: opts.direction === "in" ? opts.amount : 0,
    withdrawn: opts.direction === "out" ? opts.amount : 0,
    balance: 0,
    type: opts.direction === "out" ? "send_money" : "receive_money",
    counterparty: {
      name: opts.name,
      phoneNumber: opts.phone,
      paybillNumber: null,
      tillNumber: null,
      accountNumber: null,
    },
  };
}

function summary(name: string, phone: string): PersonSendSummary {
  return {
    nameOrInitial: name,
    maskedPhone: maskForDisplay(phone),
    totalSent: 0,
    frequency: 0,
  };
}

test("rent: monthly stable 60K over 8 months → classified as rent", () => {
  const phone = "254700000101";
  const months = [
    "2025-09-05",
    "2025-10-05",
    "2025-11-05",
    "2025-12-05",
    "2026-01-05",
    "2026-02-05",
    "2026-03-05",
    "2026-04-05",
  ];
  const txs = months.map((date) =>
    txn({ date, amount: 60_000, direction: "out", name: "AMANI SAMPLE", phone })
  );

  const enriched = enrichPersonSends([summary("AMANI SAMPLE", phone)], txs);
  const profile = enriched[0];

  assert.equal(profile.relationship, "rent", `got ${profile.relationship}`);
  assert.ok((profile.relationshipConfidence ?? 0) >= 0.78);
  assert.equal(profile.cadence, "monthly");
});

test("rent with one double-month payment still counts as rent", () => {
  // Synthetic rent jitter: one month includes two months in advance.
  const phone = "254700000101";
  const events = [
    { date: "2025-10-05", amount: 60_000 },
    { date: "2025-11-05", amount: 120_000 }, // double month
    { date: "2025-12-05", amount: 60_000 },
    { date: "2026-01-05", amount: 60_000 },
    { date: "2026-02-05", amount: 60_000 },
    { date: "2026-03-05", amount: 60_000 },
  ];
  const txs = events.map(({ date, amount }) =>
    txn({ date, amount, direction: "out", name: "RENT", phone })
  );

  const enriched = enrichPersonSends([summary("RENT", phone)], txs);
  assert.equal(enriched[0].relationship, "rent");
});

test("staff: monthly 12K stable over 6 months → classified as staff", () => {
  const phone = "254700000001";
  const months = [
    "2025-10-30",
    "2025-11-30",
    "2025-12-30",
    "2026-01-30",
    "2026-02-28",
    "2026-03-30",
  ];
  const txs = months.map((date) =>
    txn({ date, amount: 12_000, direction: "out", name: "JANE WANGARI", phone })
  );

  const enriched = enrichPersonSends([summary("JANE WANGARI", phone)], txs);
  assert.equal(enriched[0].relationship, "staff");
});

test("friend: reciprocal sends both ways → classified as friend, not rent", () => {
  const phone = "254700000002";
  // Even though the recipient receives a rent-sized amount monthly, they
  // also send money back to the user. Reciprocity is a strong friend signal
  // and must override the rent heuristic.
  const txs: Transaction[] = [];
  for (const date of ["2025-10-15", "2025-11-15", "2025-12-15", "2026-01-15", "2026-02-15"]) {
    txs.push(txn({ date, amount: 30_000, direction: "out", name: "FRIEND", phone }));
  }
  for (const date of ["2025-10-20", "2025-12-01", "2026-01-22"]) {
    txs.push(txn({ date, amount: 25_000, direction: "in", name: "FRIEND", phone }));
  }

  const enriched = enrichPersonSends([summary("FRIEND", phone)], txs);
  assert.equal(enriched[0].relationship, "friend");
  assert.notEqual(enriched[0].relationship, "rent");
});

test("casual: a single one-off send → classified as casual", () => {
  const phone = "254700000003";
  const enriched = enrichPersonSends(
    [summary("RANDOM PERSON", phone)],
    [txn({ date: "2025-12-01", amount: 500, direction: "out", name: "RANDOM PERSON", phone })]
  );
  assert.equal(enriched[0].relationship, "casual");
});

test("family: multi-month varied amounts, no reciprocity → classified as family", () => {
  const phone = "254700000004";
  const events = [
    { date: "2025-09-10", amount: 5_000 },
    { date: "2025-10-15", amount: 15_000 },
    { date: "2025-11-22", amount: 3_500 },
    { date: "2025-12-04", amount: 25_000 }, // emergency / school fees
    { date: "2026-01-09", amount: 4_000 },
    { date: "2026-02-12", amount: 8_000 },
  ];
  const txs = events.map(({ date, amount }) =>
    txn({ date, amount, direction: "out", name: "MAMA", phone })
  );

  const enriched = enrichPersonSends([summary("MAMA", phone)], txs);
  assert.equal(enriched[0].relationship, "family");
});

test("unnamed (Unknown) recipients are still classified", () => {
  // Summaries for unidentified phones use "Unknown" as the display name but
  // the underlying transactions have name=null. The classifier must still
  // pick them up via the phone-only fallback key.
  const phone = "254700000005";
  const txs: Transaction[] = [];
  for (const date of ["2025-10-05", "2025-11-05", "2025-12-05", "2026-01-05"]) {
    txs.push(txn({ date, amount: 8_000, direction: "out", name: null, phone }));
  }
  const enriched = enrichPersonSends([summary("Unknown", phone)], txs);
  assert.ok(
    enriched[0].relationship && enriched[0].relationship !== "unknown",
    `Unknown summary did not get classified, got ${enriched[0].relationship}`
  );
});
