import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessPaidReport,
  isBenchmarkContributionEnabled,
  isEmailDeliveryEnabled,
  isPaymentProcessingEnabled,
  isStatementProcessingEnabled,
} from "../runtime-features";

test("runtime features fail closed when their flags are missing", () => {
  const env = {};

  assert.equal(isStatementProcessingEnabled(env), false);
  assert.equal(isPaymentProcessingEnabled(env), false);
  assert.equal(isBenchmarkContributionEnabled(env), false);
  assert.equal(isEmailDeliveryEnabled(env), false);
});

test("paid report access is open only after confirmation when payments are enabled", () => {
  const enabled = { PAYMENTS_ENABLED: "true" };
  const disabled = { PAYMENTS_ENABLED: "false" };

  assert.equal(canAccessPaidReport("parsed", enabled), false);
  assert.equal(canAccessPaidReport("payment_pending", enabled), false);
  assert.equal(canAccessPaidReport("payment_confirmed", enabled), true);
  assert.equal(canAccessPaidReport("generating", enabled), true);
  assert.equal(canAccessPaidReport("delivered", enabled), true);
  assert.equal(canAccessPaidReport("parsed", disabled), true);
});

test("runtime features require the exact value true", () => {
  const disabled = {
    STATEMENT_PROCESSING_ENABLED: "TRUE",
    PAYMENTS_ENABLED: "1",
    BENCHMARK_CONTRIBUTION_ENABLED: "yes",
    EMAIL_DELIVERY_ENABLED: "false",
  };
  const enabled = {
    STATEMENT_PROCESSING_ENABLED: "true",
    PAYMENTS_ENABLED: "true",
    BENCHMARK_CONTRIBUTION_ENABLED: "true",
    EMAIL_DELIVERY_ENABLED: "true",
  };

  assert.equal(isStatementProcessingEnabled(disabled), false);
  assert.equal(isPaymentProcessingEnabled(disabled), false);
  assert.equal(isBenchmarkContributionEnabled(disabled), false);
  assert.equal(isEmailDeliveryEnabled(disabled), false);

  assert.equal(isStatementProcessingEnabled(enabled), true);
  assert.equal(isPaymentProcessingEnabled(enabled), true);
  assert.equal(isBenchmarkContributionEnabled(enabled), true);
  assert.equal(isEmailDeliveryEnabled(enabled), true);
});
