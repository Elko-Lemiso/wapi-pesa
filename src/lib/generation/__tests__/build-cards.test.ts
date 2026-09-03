/**
 * Sanity tests for the share card builder.
 *
 * Verifies that against a deliberately synthetic statement the builder produces:
 * - A non-empty list with the headline + punchline + stats cards present
 * - Stable indices and totals
 * - All required fields populated and non-NaN
 *
 * Run:  npx tsx --test src/lib/generation/__tests__/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReflectCards } from "../build-cards";
import { extractTransactions } from "../../parser/extract-transactions";
import { computeAnalytics } from "../../analytics/primitives";
import type { AnalyticsResult } from "../../parser/types";
import { loadSyntheticStatement } from "../../../test/load-synthetic-statement";

function loadAnalytics(): AnalyticsResult {
  return computeAnalytics(extractTransactions(loadSyntheticStatement()));
}

function withConditionalCardScenarios(analytics: AnalyticsResult): AnalyticsResult {
  return {
    ...analytics,
    subscriptions: [
      {
        name: "Sample Stream",
        paybill: "111111",
        monthlyCost: 1_200,
        totalCost: 3_600,
        isIdentified: true,
        category: "digital_services",
      },
      {
        name: "Britam Insurance",
        paybill: "222222",
        monthlyCost: 5_000,
        totalCost: 15_000,
        isIdentified: true,
        category: "insurance",
      },
      {
        name: "Kenya Power",
        paybill: "333333",
        monthlyCost: 3_000,
        totalCost: 9_000,
        isIdentified: true,
        category: "utilities",
      },
    ],
    personToPersonSends: [
      { nameOrInitial: "Renta Sample", maskedPhone: "2547******101", totalSent: 60_000, frequency: 3, relationship: "rent" },
      { nameOrInitial: "Kazi Sample", maskedPhone: "2547******102", totalSent: 40_000, frequency: 3, relationship: "staff" },
      { nameOrInitial: "Rafiki Sample", maskedPhone: "2547******103", totalSent: 6_000, frequency: 3, relationship: "friend" },
      { nameOrInitial: "Familia Sample", maskedPhone: "2547******104", totalSent: 4_000, frequency: 2, relationship: "family" },
      { nameOrInitial: "Jirani Sample", maskedPhone: "2547******105", totalSent: 2_000, frequency: 1, relationship: "casual" },
    ],
  };
}

test("buildReflectCards: produces required core cards from a synthetic statement", () => {
  const analytics = loadAnalytics();
  const cards = buildReflectCards(analytics);

  assert.ok(cards.length >= 3, `expected at least the core cards, got ${cards.length}`);
  const types = new Set(cards.map((c) => c.cardType));
  assert.ok(types.has("headline"), "headline card missing");
  assert.ok(types.has("punchline"), "punchline card missing");
  assert.ok(types.has("stats"), "stats card missing");

  // Indices and totals are stable + sequential
  cards.forEach((c, i) => {
    assert.equal(c.index, i + 1, `card #${i + 1} has wrong index ${c.index}`);
    assert.equal(c.total, cards.length, `card ${c.id} has wrong total ${c.total}`);
    assert.ok(c.headline.length > 0, `card ${c.id} missing headline`);
    assert.ok(c.tagline.length > 0, `card ${c.id} missing tagline`);
    assert.ok(c.id, `card #${i + 1} missing id`);
  });
});

test("buildReflectCards: privacy mode replaces names with initials in people map", () => {
  const analytics = withConditionalCardScenarios(loadAnalytics());

  const safe = buildReflectCards(analytics, { privacyMode: true });

  const safePeople = safe.find((c) => c.cardType === "peopleMap");
  const safeBills = safe.find((c) => c.cardType === "billsMap");

  assert.ok(safePeople && safePeople.cardType === "peopleMap", "people map card missing");
  assert.ok(safeBills && safeBills.cardType === "billsMap", "bills map card missing");

  for (const card of [safePeople, safeBills]) {
    for (const row of card.data.rows) {
      assert.match(
        row.name,
        /^[A-Z](\.[A-Z])*\.?$/,
        `privacy mode name "${row.name}" on ${card.cardType} looks like a real name, expected initials`
      );
    }
  }
});

test("buildReflectCards: top recipient classified as rent never gets friend tagline", () => {
  const analytics = withConditionalCardScenarios(loadAnalytics());
  const cards = buildReflectCards(analytics);

  const top = cards.find((c) => c.cardType === "topRecipient");
  assert.ok(top && top.cardType === "topRecipient", "top recipient card missing");
  assert.equal(top.data.relationship, "rent");

  // Friend-shaped phrases that imply reciprocity / friendship — never
  // appropriate for a rent or staff recipient.
  const friendPhrases = [/owe you/i, /best friend/i, /bff/i, /coffee/i];

  for (const re of friendPhrases) {
    assert.ok(
      !re.test(top.tagline),
      `tagline "${top.tagline}" is friend-shaped but recipient classified as ${top.data.relationship}`
    );
  }
});

test("buildReflectCards: subscriptions card excludes insurance/utilities", () => {
  const analytics = withConditionalCardScenarios(loadAnalytics());
  const cards = buildReflectCards(analytics);

  const subs = cards.find((c) => c.cardType === "subscriptions");
  assert.ok(subs && subs.cardType === "subscriptions", "subscriptions card missing");

  const blocked = /britam|jubilee|sanlam|nssf|kenya power|nairobi water|safaricom home|kra|ncba|stanbic|loan/i;
  for (const item of subs.data.top) {
    assert.ok(
      !blocked.test(item.name),
      `subscriptions card includes "${item.name}" — should be excluded as insurance/utility/loan`
    );
  }
  assert.deepEqual(subs.data.top.map((item) => item.name), ["Sample Stream"]);
});

test("buildReflectCards: bills card and people card never share a recipient", () => {
  const analytics = withConditionalCardScenarios(loadAnalytics());
  const cards = buildReflectCards(analytics);

  const bills = cards.find((c) => c.cardType === "billsMap");
  const people = cards.find((c) => c.cardType === "peopleMap");
  assert.ok(bills && bills.cardType === "billsMap", "bills map card missing");
  assert.ok(people && people.cardType === "peopleMap", "people map card missing");

  const billNames = new Set(bills.data.rows.map((r) => r.name));
  for (const r of people.data.rows) {
    assert.ok(
      !billNames.has(r.name),
      `recipient "${r.name}" appears on both Bills and People cards`
    );
  }
});

test("buildReflectCards: bills/people maps never list more than 5 rows", () => {
  const analytics = withConditionalCardScenarios(loadAnalytics());
  const cards = buildReflectCards(analytics);

  const bills = cards.find((card) => card.cardType === "billsMap");
  const people = cards.find((card) => card.cardType === "peopleMap");
  assert.ok(bills && bills.cardType === "billsMap", "bills map card missing");
  assert.ok(people && people.cardType === "peopleMap", "people map card missing");

  for (const card of [bills, people]) {
    assert.ok(
      card.data.rows.length <= 5,
      `${card.cardType} has ${card.data.rows.length} rows, expected ≤ 5`
    );
  }
});

test("buildReflectCards: stats card has between 4 and 8 rows", () => {
  const analytics = loadAnalytics();
  const cards = buildReflectCards(analytics);

  const stats = cards.find((c) => c.cardType === "stats");
  if (!stats || stats.cardType !== "stats") {
    assert.fail("stats card not generated");
  }
  assert.ok(stats.data.rows.length >= 4 && stats.data.rows.length <= 8, `stats had ${stats.data.rows.length} rows`);
});
