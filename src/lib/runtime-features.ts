type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

function isEnabled(env: RuntimeEnvironment, name: string): boolean {
  return env[name] === "true";
}

export function isStatementProcessingEnabled(
  env: RuntimeEnvironment = process.env
): boolean {
  return isEnabled(env, "STATEMENT_PROCESSING_ENABLED");
}

export function isPaymentProcessingEnabled(
  env: RuntimeEnvironment = process.env
): boolean {
  return isEnabled(env, "PAYMENTS_ENABLED");
}

export function isBenchmarkContributionEnabled(
  env: RuntimeEnvironment = process.env
): boolean {
  return isEnabled(env, "BENCHMARK_CONTRIBUTION_ENABLED");
}

export function isEmailDeliveryEnabled(
  env: RuntimeEnvironment = process.env
): boolean {
  return isEnabled(env, "EMAIL_DELIVERY_ENABLED");
}

export function canAccessPaidReport(
  status: string,
  env: RuntimeEnvironment = process.env
): boolean {
  if (!isPaymentProcessingEnabled(env)) return true;
  return ["payment_confirmed", "generating", "delivered"].includes(status);
}
