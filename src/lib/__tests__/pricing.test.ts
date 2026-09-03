import { test } from "node:test";
import assert from "node:assert/strict";
import { getKesPrice } from "../pricing";

test("report pricing has one shared source of truth", () => {
  assert.equal(getKesPrice("reflect"), 300);
  assert.equal(getKesPrice("understand", "single_month"), 800);
  assert.equal(getKesPrice("understand", "annual"), 2_000);
  assert.equal(getKesPrice("understand"), 2_000);
});
