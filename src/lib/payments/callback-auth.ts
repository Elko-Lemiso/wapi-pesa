import { timingSafeEqual } from "node:crypto";

const MIN_CALLBACK_TOKEN_LENGTH = 32;

export function isValidMpesaCallbackToken(
  provided: string | null,
  expected = process.env.MPESA_CALLBACK_TOKEN
): boolean {
  if (
    !provided ||
    !expected ||
    expected.length < MIN_CALLBACK_TOKEN_LENGTH ||
    provided.length !== expected.length
  ) {
    return false;
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function buildMpesaCallbackUrl(
  callbackUrl = process.env.MPESA_CALLBACK_URL,
  token = process.env.MPESA_CALLBACK_TOKEN
): string {
  if (!callbackUrl) throw new Error("MPESA_CALLBACK_URL not configured");
  if (!token || token.length < MIN_CALLBACK_TOKEN_LENGTH) {
    throw new Error("MPESA_CALLBACK_TOKEN must contain at least 32 characters");
  }

  const url = new URL(callbackUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
