/**
 * End-to-end parser invariants verified against a bundled synthetic statement.
 * Verifies that each colliding masked phone is split correctly into distinct
 * named contacts (Bug 1) and that the full pipeline reconciles (Bug 2).
 *
 * Run:  npx tsx --test src/lib/parser/__tests__/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTransactions, reconcile } from "../extract-transactions";
import { computeAnalytics } from "../../analytics/primitives";
import { loadSyntheticStatement } from "../../../test/load-synthetic-statement";

test("parser: invariant — no masked phone groups two distinct names in personSends", () => {
  const pages = loadSyntheticStatement();

  const statement = extractTransactions(pages);
  const analytics = computeAnalytics(statement);

  const sharedPhonePeople = analytics.personToPersonSends
    .filter((person) => person.maskedPhone === "2547XX XXX 111")
    .map((person) => person.nameOrInitial.toUpperCase())
    .sort();
  assert.deepEqual(sharedPhonePeople, ["AMANI SAMPLE", "ZURI EXAMPLE"]);
});

test("parser: invariant — top counterparties tables have no name collisions per masked phone", () => {
  const pages = loadSyntheticStatement();

  const statement = extractTransactions(pages);
  const analytics = computeAnalytics(statement);

  for (const list of [analytics.topCounterpartiesByAmount, analytics.topCounterpartiesByFrequency]) {
    const names = list
      .filter((counterparty) => counterparty.maskedPhone === "2547XX XXX 111")
      .map((counterparty) => counterparty.name.toUpperCase());
    assert.ok(names.includes("AMANI SAMPLE"), "AMANI SAMPLE missing from shared-phone group");
    assert.ok(names.includes("ZURI EXAMPLE"), "ZURI EXAMPLE missing from shared-phone group");
  }
});

test("parser: invariant — receipt grouping reconciles within tolerance", () => {
  const pages = loadSyntheticStatement();

  const statement = extractTransactions(pages);
  const recon = reconcile(statement.transactions);

  const grouped = statement.transactions.find((transaction) => transaction.receiptNo === "SYNTH00012");
  assert.ok(grouped, "multi-row synthetic receipt was not parsed");
  assert.equal(grouped.fee, 50, "charge row was not grouped into the principal transaction");
  assert.equal(statement.transactions.length, 17, "multi-row receipt produced a duplicate transaction");

  // |discrepancy| must be within the larger of KES 100 or 1% of total volume.
  assert.equal(
    recon.reconciles,
    true,
    `reconciliation failed: discrepancy KES ${recon.discrepancy.toFixed(2)} ` +
      `(${recon.discrepancyPct.toFixed(3)}%) — in=${recon.totalInflow} out=${recon.totalOutflow} ` +
      `fees=${recon.totalFees} computedΔ=${recon.computedDelta} observedΔ=${recon.observedDelta}`
  );
});

test("parser: invariant — partial months are excluded from busiest/quietest", () => {
  const pages = loadSyntheticStatement();

  const statement = extractTransactions(pages);
  assert.ok(statement.statementPeriod, "synthetic fixture must declare a statement period");
  const partialEnd = new Date(2026, 2, 20, 23, 59, 59);
  const partialStatement = {
    ...statement,
    transactions: statement.transactions.filter(
      (transaction) => transaction.completionTime <= partialEnd
    ),
    statementPeriod: { ...statement.statementPeriod, to: partialEnd },
  };
  const analytics = computeAnalytics(partialStatement);
  const partialEndKey = partialEnd.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  assert.notEqual(analytics.streaks.busiestMonth.month, partialEndKey);
  assert.notEqual(analytics.streaks.quietestMonth.month, partialEndKey);
});

test("parser: invariant — international/promotion source names are never garbage", () => {
  const pages = loadSyntheticStatement();

  const statement = extractTransactions(pages);
  const analytics = computeAnalytics(statement);

  for (const s of analytics.internationalTransfers.sources) {
    assert.ok(/[A-Za-z]/.test(s.name), `international source has no alpha char: "${s.name}"`);
    assert.ok(s.name.trim().length >= 3, `international source too short: "${s.name}"`);
  }
  for (const s of analytics.promotionsAndCashback.sources) {
    assert.ok(/[A-Za-z]/.test(s.name), `promotion source has no alpha char: "${s.name}"`);
    assert.ok(s.name.trim().length >= 3, `promotion source too short: "${s.name}"`);
  }
});

test("parser: invariant — self-transfers excluded from People panel", () => {
  const pages = loadSyntheticStatement();

  const statement = extractTransactions(pages);
  const analytics = computeAnalytics(statement);
  const holder = (statement.accountHolder || "").toLowerCase();
  assert.ok(holder, "synthetic fixture must declare an account holder");

  const salary = statement.transactions.find((transaction) => transaction.receiptNo === "SYNTH00001");
  assert.equal(salary?.counterparty.name, "SAMPLE EMPLOYER");

  for (const p of analytics.personToPersonSends) {
    const recipient = p.nameOrInitial.toLowerCase();
    // The recipient name must not contain ALL of the holder's name parts.
    const holderParts = holder.split(/\s+/).filter((w) => w.length >= 3);
    const matchedParts = holderParts.filter((w) => recipient.includes(w));
    assert.ok(
      matchedParts.length < 2,
      `self-transfer leaked into personSends: "${p.nameOrInitial}" vs holder "${holder}"`
    );
  }
});
