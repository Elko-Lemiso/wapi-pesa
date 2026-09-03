import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAnalytics } from "../analytics/primitives";
import { extractTransactions } from "../parser/extract-transactions";
import { SHOWCASE_PREVIEW } from "../showcase-preview";
import { loadSyntheticStatement } from "../../test/load-synthetic-statement";

test("homepage preview stays in sync with the synthetic statement", () => {
  const analytics = computeAnalytics(
    extractTransactions(loadSyntheticStatement())
  );

  assert.equal(
    SHOWCASE_PREVIEW.totalMoved,
    analytics.totalInflows + analytics.totalOutflows
  );
  assert.equal(SHOWCASE_PREVIEW.transactionCount, analytics.transactionCount);
  assert.equal(
    SHOWCASE_PREVIEW.selfTransferCount,
    analytics.selfTransfers.count
  );
  assert.ok(analytics.period, "synthetic fixture must declare a period");
  const fromMonth = analytics.period.from.toLocaleString("en-US", { month: "short" });
  const toMonth = analytics.period.to.toLocaleString("en-US", { month: "short" });
  assert.equal(
    SHOWCASE_PREVIEW.periodLabel,
    `${fromMonth}–${toMonth} ${analytics.period.to.getFullYear()}`
  );
  assert.deepEqual(
    SHOWCASE_PREVIEW.categories.map(({ label, percentage }) => ({
      category: label,
      percentage,
    })),
    analytics.categoryBreakdown.map(({ category, percentage }) => ({
      category,
      percentage,
    }))
  );
});
