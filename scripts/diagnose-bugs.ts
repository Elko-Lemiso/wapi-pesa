/**
 * Diagnostic: parse the synthetic statement fixture and dump:
 *  - All transactions tagged to masked phones with multiple distinct names (Bug 1)
 *  - All receipts with multiple rows (Bug 2)
 *  - Garbage names in international/promotion sources (Bug 3)
 *  - Self-transfers being treated as P2P (Bug 4)
 *  - Inflation panel inputs (Bug 6)
 *
 * The default input is synthetic. Passing private statement text can print
 * sensitive derived values to the terminal and should only be done locally.
 */
import { extractTransactions } from "../src/lib/parser/extract-transactions";
import { computeAnalytics } from "../src/lib/analytics/primitives";
import { loadSyntheticStatement } from "../src/test/load-synthetic-statement";

function main() {
  const path = process.argv[2] || "src/test/fixtures/synthetic-personal-statement.txt";
  console.log(`Loading: ${path}`);

  const pages = loadSyntheticStatement(path);
  console.log(`Loaded ${pages.length} pages`);

  const statement = extractTransactions(pages);
  console.log(`\nParsed:`);
  console.log(`  Account holder: ${statement.accountHolder}`);
  console.log(`  Phone:          ${statement.phoneNumber}`);
  console.log(`  Period:         ${statement.statementPeriod ? `${statement.statementPeriod.from.toISOString().slice(0, 10)} → ${statement.statementPeriod.to.toISOString().slice(0, 10)}` : "?"}`);
  console.log(`  Transactions:   ${statement.transactions.length}`);

  const analytics = computeAnalytics(statement);
  console.log(`\nAnalytics:`);
  console.log(`  Money in:  KES ${analytics.totalInflows.toLocaleString()}`);
  console.log(`  Money out: KES ${analytics.totalOutflows.toLocaleString()}`);
  console.log(`  Net flow:  KES ${analytics.netFlow.toLocaleString()}`);

  // ============ Bug 1: phone collisions ============
  console.log(`\n========== BUG 1: masked phone collisions ==========`);
  const byPhone = new Map<string, { name: string; count: number; total: number }[]>();
  for (const t of statement.transactions) {
    if (t.type !== "send_money" || !t.counterparty.phoneNumber) continue;
    const phone = t.counterparty.phoneNumber;
    const name = (t.counterparty.name || "?").trim().toUpperCase();
    if (!byPhone.has(phone)) byPhone.set(phone, []);
    const slots = byPhone.get(phone)!;
    const slot = slots.find((s) => s.name === name);
    if (slot) {
      slot.count++;
      slot.total += t.amount;
    } else {
      slots.push({ name, count: 1, total: t.amount });
    }
  }
  let collisionCount = 0;
  for (const [phone, slots] of byPhone) {
    if (slots.length > 1) {
      collisionCount++;
      const txns = slots.reduce((s, x) => s + x.count, 0);
      const sum = slots.reduce((s, x) => s + x.total, 0);
      console.log(`  ${phone}  →  ${slots.length} distinct names  (${txns} txns, KES ${sum.toLocaleString()})`);
      for (const s of slots) {
        console.log(`     - ${s.name.padEnd(30)} ${String(s.count).padStart(3)} txns  KES ${Math.round(s.total).toLocaleString()}`);
      }
    }
  }
  console.log(`Total colliding masked numbers: ${collisionCount}`);

  // ============ Bug 3: garbage names ============
  console.log(`\n========== BUG 3: garbage names in income/intl/promo ==========`);
  console.log(`  International sources:`);
  for (const s of analytics.internationalTransfers.sources) {
    console.log(`    - "${s.name}"  (${s.count}x, KES ${Math.round(s.total).toLocaleString()})  ${isGarbage(s.name) ? "← GARBAGE" : ""}`);
  }
  console.log(`  Promotion sources:`);
  for (const s of analytics.promotionsAndCashback.sources) {
    console.log(`    - "${s.name}"  (${s.count}x, KES ${Math.round(s.total).toLocaleString()})  ${isGarbage(s.name) ? "← GARBAGE" : ""}`);
  }
  console.log(`  Income streams:`);
  for (const s of analytics.incomeStreams) {
    console.log(`    - "${s.source}" (${s.type})  (${s.frequency}x, KES ${Math.round(s.totalAmount).toLocaleString()})  ${isGarbage(s.source) ? "← GARBAGE" : ""}`);
  }

  // ============ Bug 4: self-transfers in P2P ============
  console.log(`\n========== BUG 4: self-transfers misclassified as P2P ==========`);
  const holder = (statement.accountHolder || "").toUpperCase();
  const firstWord = holder.split(/\s+/)[0];
  const lastWord = holder.split(/\s+/).pop() || "";
  console.log(`  Account holder: "${statement.accountHolder}"`);
  for (const p of analytics.personToPersonSends) {
    const upper = p.nameOrInitial.toUpperCase();
    const matchesHolder = upper.includes(firstWord) || upper.includes(lastWord);
    if (matchesHolder) {
      console.log(`    - "${p.nameOrInitial}"  ${p.maskedPhone}  ${p.frequency}x  KES ${Math.round(p.totalSent).toLocaleString()}  ← LOOKS LIKE SELF`);
    }
  }
  // Also leak total
  if (analytics.leakTotal) {
    console.log(`  Leak total items:`);
    for (const item of analytics.leakTotal.items) {
      const upper = item.name.toUpperCase();
      const matchesHolder = upper.includes(firstWord) || upper.includes(lastWord);
      const flag = matchesHolder ? " ← LOOKS LIKE SELF" : "";
      console.log(`    - "${item.name}"  KES ${Math.round(item.monthlyCost)}/mo${flag}`);
    }
  }

  // ============ Bug 5: recurring grouped by paybill ============
  console.log(`\n========== BUG 5: recurring/subscriptions per merchant vs paybill ==========`);
  const subs = analytics.subscriptions;
  const grouped = new Map<string, number>();
  for (const sub of subs) {
    const key = sub.name.toUpperCase().replace(/\..*$/, "").trim();
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  console.log(`  Subscriptions list:`);
  for (const sub of subs) {
    console.log(`    - "${sub.name}"  (paybill ${sub.paybill ?? "?"})  KES ${Math.round(sub.monthlyCost)}/mo`);
  }

  // ============ Bug 6: inflation panel ============
  console.log(`\n========== BUG 6: inflation exposure panel ==========`);
  if (analytics.inflationExposure) {
    for (const m of analytics.inflationExposure.merchants) {
      console.log(`    - "${m.name}"  ${m.changePct}%`);
    }
  } else {
    console.log("  (none)");
  }

  // ============ Bug 7: partial month ============
  console.log(`\n========== BUG 7: monthly counts (partial-month detection) ==========`);
  console.log(`  Quietest: ${JSON.stringify(analytics.streaks.quietestMonth)}`);
  console.log(`  Busiest:  ${JSON.stringify(analytics.streaks.busiestMonth)}`);
  console.log(`  All months:`);
  for (const m of analytics.monthlyTrends) {
    console.log(`    - ${m.month} ${m.year}  txns=${m.transactionCount}`);
  }

  // ============ Categorisation breakdown ============
  console.log(`\n========== CATEGORY BREAKDOWN ==========`);
  for (const c of analytics.categoryBreakdown) {
    console.log(`  ${c.category.padEnd(28)} KES ${String(Math.round(c.total)).padStart(10)}  (${String(c.percentage).padStart(5)}%)  ${c.transactionCount} txns`);
  }
  const uncategorized = analytics.categoryBreakdown.find((c) => c.category === "Uncategorized");
  if (uncategorized) {
    console.log(`  Uncategorized share: ${uncategorized.percentage}%  (target: <10%)`);
  }
  console.log(`\n========== SELF TRANSFERS ==========`);
  console.log(`  count: ${analytics.selfTransfers.count}, total: KES ${analytics.selfTransfers.totalAmount.toLocaleString()}`);
  for (const d of analytics.selfTransfers.destinations) {
    console.log(`    - ${d.name}  ${d.count}x  KES ${Math.round(d.total).toLocaleString()}`);
  }

  // ============ Reconciliation check ============
  console.log(`\n========== RECONCILIATION ==========`);
  // Sort by completionTime — newest first in the list (statement order)
  const txns = [...statement.transactions];
  // Find latest transaction's balance and earliest transaction's pre-balance
  const sortedAsc = [...txns].sort((a, b) => a.completionTime.getTime() - b.completionTime.getTime());
  const earliest = sortedAsc[0];
  const latest = sortedAsc[sortedAsc.length - 1];
  console.log(`  Earliest: ${earliest.receiptNo} ${earliest.completionTime.toISOString().slice(0, 10)}  balance after = ${earliest.balance}`);
  console.log(`  Latest:   ${latest.receiptNo} ${latest.completionTime.toISOString().slice(0, 10)}  balance after = ${latest.balance}`);

  // Reconstruct pre-balance of the earliest tx by reversing it
  const earliestPre = earliest.balance + (earliest.direction === "out" ? earliest.amount + earliest.fee : -earliest.amount + earliest.fee);

  const totalInflow = txns.filter(t => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const totalOutflow = txns.filter(t => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const totalFees = txns.reduce((s, t) => s + t.fee, 0);
  const computedDelta = totalInflow - totalOutflow - totalFees;
  const observedDelta = latest.balance - earliestPre;
  console.log(`  Sum inflows: ${totalInflow.toLocaleString()}`);
  console.log(`  Sum outflows: ${totalOutflow.toLocaleString()}`);
  console.log(`  Sum fees:    ${totalFees.toLocaleString()}`);
  console.log(`  Computed Δbalance (in - out - fees): ${computedDelta.toLocaleString()}`);
  console.log(`  Observed Δbalance (latest - earliestPre): ${observedDelta.toLocaleString()}`);
  console.log(`  Discrepancy: ${(observedDelta - computedDelta).toLocaleString()}`);
}

function isGarbage(name: string | null | undefined): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (/^\d+T?$/i.test(trimmed)) return true;
  if (!/[A-Za-z]/.test(trimmed)) return true;
  return false;
}

main();
