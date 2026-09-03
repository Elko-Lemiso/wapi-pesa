import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMpesaCallbackUrl,
  isValidMpesaCallbackToken,
} from "../callback-auth";

const TOKEN = "synthetic-callback-token-1234567890";

test("M-Pesa callback tokens require an exact constant-length match", () => {
  assert.equal(isValidMpesaCallbackToken(TOKEN, TOKEN), true);
  assert.equal(isValidMpesaCallbackToken("x".repeat(TOKEN.length), TOKEN), false);
  assert.equal(isValidMpesaCallbackToken(null, TOKEN), false);
  assert.equal(isValidMpesaCallbackToken("short", "short"), false);
});

test("M-Pesa callback URL carries the configured secret token", () => {
  const callback = new URL(
    buildMpesaCallbackUrl("https://example.test/api/pay/mpesa/callback", TOKEN)
  );
  assert.equal(callback.origin, "https://example.test");
  assert.equal(callback.pathname, "/api/pay/mpesa/callback");
  assert.equal(callback.searchParams.get("token"), TOKEN);
});
