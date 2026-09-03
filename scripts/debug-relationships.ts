/**
 * Quick diagnostic: print the relationship classification for every top
 * recipient produced by the analytics pipeline against the bundled synthetic
 * statement. Do not point this diagnostic at private financial data.
 */
import { extractTransactions } from "../src/lib/parser/extract-transactions";
import { computeAnalytics } from "../src/lib/analytics/primitives";
import { buildReflectCards } from "../src/lib/generation/build-cards";
import { loadSyntheticStatement } from "../src/test/load-synthetic-statement";

const pages = loadSyntheticStatement();
const statement = extractTransactions(pages);
const analytics = computeAnalytics(statement);

console.log("\n=== Top P2P recipients with relationship classification ===\n");
const rows = analytics.personToPersonSends.slice(0, 12);
for (const p of rows) {
  console.log(
    `${p.nameOrInitial.padEnd(28)} ${String(p.totalSent.toLocaleString()).padStart(10)} ` +
      `× ${String(p.frequency).padStart(2)}  ` +
      `→ ${(p.relationship ?? "?").padEnd(10)} ` +
      `(${p.cadence ?? "?"}, CV ${(p.amountCV ?? 0).toFixed(2)}, ` +
      `${p.monthsActive ?? "?"} months, conf ${(p.relationshipConfidence ?? 0).toFixed(2)}) ` +
      `${p.inferredRole ?? ""}`
  );
}

console.log("\n=== Subscription category breakdown ===\n");
for (const s of analytics.subscriptions.slice(0, 12)) {
  console.log(
    `${s.name.padEnd(34)} ${String(s.monthlyCost.toLocaleString()).padStart(10)}/mo ` +
      `${(s.category ?? "—").padEnd(14)}`
  );
}

console.log("\n=== Generated cards (taglines & key copy) ===\n");
const cards = buildReflectCards(analytics);
for (const c of cards) {
  console.log(`${String(c.index).padStart(2, "0")} ${c.cardType.padEnd(15)} ${c.headline}`);
  console.log(`     tagline: "${c.tagline}"`);
  if (c.cardType === "topRecipient") {
    console.log(
      `     relationship=${c.data.relationship} (${c.data.relationshipLabel}), eyebrow="${c.data.eyebrow}"`
    );
  }
  if (c.cardType === "billsMap" || c.cardType === "peopleMap") {
    for (const r of c.data.rows) {
      console.log(`        ${r.rank}. ${r.name} (${r.roleLabel}) — ${r.amount}`);
    }
  }
  if (c.cardType === "subscriptions") {
    for (const t of c.data.top) {
      console.log(`        ${t.name} — ${t.monthly}/mo`);
    }
  }
  if (c.cardType === "punchline") {
    console.log(`     line: "${c.data.line}"`);
  }
}
