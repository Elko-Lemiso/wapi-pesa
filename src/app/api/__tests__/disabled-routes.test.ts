import { test } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { GET as getCapabilities } from "../capabilities/route";
import { POST as contribute } from "../benchmarks/contribute/route";
import { POST as sendEmail } from "../email/route";
import { POST as parseStatement } from "../parse/route";
import { POST as startMpesa } from "../pay/mpesa/route";
import { POST as acceptMpesaCallback } from "../pay/mpesa/callback/route";
import { POST as startStripe } from "../pay/stripe/route";
import { POST as acceptStripeWebhook } from "../pay/stripe/webhook/route";

const FEATURE_FLAGS = [
  "STATEMENT_PROCESSING_ENABLED",
  "PAYMENTS_ENABLED",
  "BENCHMARK_CONTRIBUTION_ENABLED",
  "EMAIL_DELIVERY_ENABLED",
] as const;

function requestThatMustNotBeRead(): NextRequest {
  return new Proxy({} as NextRequest, {
    get() {
      throw new Error("disabled route read the request");
    },
  });
}

test("sensitive routes fail closed before reading request data", async () => {
  const original = Object.fromEntries(
    FEATURE_FLAGS.map((name) => [name, process.env[name]])
  );

  try {
    for (const name of FEATURE_FLAGS) process.env[name] = "false";

    const cases = [
      [parseStatement, "PUBLIC_PREVIEW_ONLY"],
      [contribute, "SHOWCASE_CONTRIBUTION_DISABLED"],
      [sendEmail, "SHOWCASE_EMAIL_DISABLED"],
      [startMpesa, "SHOWCASE_PAYMENTS_DISABLED"],
      [acceptMpesaCallback, "SHOWCASE_PAYMENTS_DISABLED"],
      [startStripe, "SHOWCASE_PAYMENTS_DISABLED"],
      [acceptStripeWebhook, "SHOWCASE_PAYMENTS_DISABLED"],
    ] as const;

    for (const [handler, expectedCode] of cases) {
      const response = await handler(requestThatMustNotBeRead());
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, expectedCode);
    }

    const capabilities = await getCapabilities();
    assert.equal(capabilities.headers.get("cache-control"), "no-store");
    assert.deepEqual(await capabilities.json(), {
      statementProcessing: false,
      payments: false,
      emailDelivery: false,
    });
  } finally {
    for (const name of FEATURE_FLAGS) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("statement route rejects an unbounded body before multipart parsing", async () => {
  const original = process.env.STATEMENT_PROCESSING_ENABLED;
  process.env.STATEMENT_PROCESSING_ENABLED = "true";
  let formDataRead = false;
  const request = {
    headers: { get: () => null },
    formData: async () => {
      formDataRead = true;
      throw new Error("formData must not be read");
    },
  } as unknown as NextRequest;

  try {
    const response = await parseStatement(request);
    assert.equal(response.status, 411);
    assert.equal(formDataRead, false);
  } finally {
    if (original === undefined) delete process.env.STATEMENT_PROCESSING_ENABLED;
    else process.env.STATEMENT_PROCESSING_ENABLED = original;
  }
});

test("enabled M-Pesa callback rejects an invalid token before reading JSON", async () => {
  const originalPayments = process.env.PAYMENTS_ENABLED;
  const originalToken = process.env.MPESA_CALLBACK_TOKEN;
  process.env.PAYMENTS_ENABLED = "true";
  process.env.MPESA_CALLBACK_TOKEN = "synthetic-callback-token-1234567890";
  let jsonRead = false;
  const request = {
    nextUrl: {
      searchParams: { get: () => "invalid-callback-token--1234567890" },
    },
    json: async () => {
      jsonRead = true;
      throw new Error("callback JSON must not be read");
    },
  } as unknown as NextRequest;

  try {
    const response = await acceptMpesaCallback(request);
    assert.equal(response.status, 401);
    assert.equal(jsonRead, false);
  } finally {
    if (originalPayments === undefined) delete process.env.PAYMENTS_ENABLED;
    else process.env.PAYMENTS_ENABLED = originalPayments;
    if (originalToken === undefined) delete process.env.MPESA_CALLBACK_TOKEN;
    else process.env.MPESA_CALLBACK_TOKEN = originalToken;
  }
});
