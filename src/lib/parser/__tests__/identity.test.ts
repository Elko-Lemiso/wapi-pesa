/**
 * Parser identity invariants. Run with: `npx tsx --test src/lib/parser/__tests__/*.test.ts`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactKey,
  isInvalidName,
  isSelfName,
  isSelfPhone,
  normalizeMerchantName,
} from "../identity";

test("contactKey: distinct names with same masked phone do NOT collide", () => {
  // Bug 1 regression test with deliberately synthetic names.
  const a = contactKey("AMANI SAMPLE", "2547******111");
  const b = contactKey("ZURI EXAMPLE", "2547******111");
  const c = contactKey("KITO DEMO", "2547******111");
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(b, c);
});

test("contactKey: same name + masked phone is stable across calls", () => {
  const k1 = contactKey("Nia Sample", "07******222");
  const k2 = contactKey("NIA SAMPLE", "07******222");
  assert.equal(k1, k2, "names should be case-insensitive in the key");
});

test("contactKey: missing name still produces a valid key on phone alone", () => {
  const k = contactKey(null, "2547******111");
  assert.equal(k, "p:2547******111");
});

test("isSelfPhone: matches owner number across formats", () => {
  // Deliberately synthetic owner number.
  assert.equal(isSelfPhone("254700000000", "0700000000"), true);
  assert.equal(isSelfPhone("0700000000", "0700000000"), true);
  // unrelated
  assert.equal(isSelfPhone("0700000001", "0700000000"), false);
});

test("isSelfPhone: handles masked phones", () => {
  assert.equal(isSelfPhone("07****000", "0700000000"), true);
  assert.equal(isSelfPhone("2547******000", "254700000000"), true);
  // different prefix → not self
  assert.equal(isSelfPhone("01******000", "0700000000"), false);
});

test("isSelfName: detects holder by 2-token overlap", () => {
  // Bug 4 regression — recipient name matches a synthetic account holder.
  assert.equal(isSelfName("Amina User", "Amina Sample User"), true);
  assert.equal(isSelfName("Amina Sample", "Amina Sample User"), true);
  assert.equal(isSelfName("Sample User", "Amina Sample User"), true);
});

test("isSelfName: a single-name share is not enough on its own", () => {
  // Random recipient happens to share first name "Amina" — should NOT be self.
  // (We keep it conservative: 1-token overlap on a 3-token holder name is not self.)
  assert.equal(isSelfName("Amina Example", "Amina Sample User"), false);
  assert.equal(isSelfName("Sample", "Amina Sample User"), false);
});

test("isInvalidName: rejects garbage fragments (Bug 3)", () => {
  // Things we saw in the wild from the international/promotion bug.
  assert.equal(isInvalidName("22"), true);
  assert.equal(isInvalidName("037"), true);
  assert.equal(isInvalidName("012T"), true);
  assert.equal(isInvalidName("099"), true);
  assert.equal(isInvalidName("46"), true);
  assert.equal(isInvalidName(""), true);
  assert.equal(isInvalidName(null), true);
  assert.equal(isInvalidName("60,000.00"), true);
  // Real names should NOT be flagged
  assert.equal(isInvalidName("REMITLY"), false);
  assert.equal(isInvalidName("DIGITAL IMTS"), false);
  assert.equal(isInvalidName("LOOP B2C"), false);
});

test("normalizeMerchantName: collapses common subscription variants (Bug 5)", () => {
  assert.equal(normalizeMerchantName("NETFLIX.COM"), "Netflix");
  assert.equal(normalizeMerchantName("Netflix.com Los Gatos"), "Netflix");
  assert.equal(normalizeMerchantName("NETFLIX"), "Netflix");
  assert.equal(normalizeMerchantName("CURSOR AI POWERED IDE"), "Cursor");
  assert.equal(normalizeMerchantName("CURSOR, AI POWERED IDE"), "Cursor");
  assert.equal(normalizeMerchantName("CURSOR USAGE MID AUG"), "Cursor");
  assert.equal(normalizeMerchantName("ANTHROPIC"), "Anthropic");
  assert.equal(normalizeMerchantName("CLAUDE.AI SUBSCRIPTION"), "Claude");
  assert.equal(normalizeMerchantName("SPOTIFY"), "Spotify");
  assert.equal(normalizeMerchantName("Spotify Stockholm SE"), "Spotify");
  assert.equal(normalizeMerchantName("GOOGLE *YouTubePremium"), "YouTube Premium");
});
