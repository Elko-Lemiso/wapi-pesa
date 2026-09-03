import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAnalytics } from "../../analytics/primitives";
import { extractTransactions } from "../../parser/extract-transactions";
import { buildReflectCopyPrompt } from "../reflect-prompts";
import { loadSyntheticStatement } from "../../../test/load-synthetic-statement";

test("reflect LLM prompt omits contact names and phone fragments", () => {
  const statement = extractTransactions(loadSyntheticStatement());
  const analytics = computeAnalytics(statement);
  const { userPrompt } = buildReflectCopyPrompt(analytics);

  assert.doesNotMatch(
    userPrompt,
    /AMANI|ZURI|SAMPLE MARKET|SAMPLE EMPLOYER|SAMPLE REMITTANCE|2547|\*{3,}/i
  );
  assert.match(userPrompt, /Recipient 1/);
});
