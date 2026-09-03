import { getSession, type SessionData } from "./session";

// In-memory mapping of payment references to session IDs
const paymentRefToSession = new Map<string, string>();

export function registerPaymentRef(ref: string, sessionId: string): void {
  paymentRefToSession.set(ref, sessionId);
}

export function findSessionByPaymentRef(ref: string): SessionData | null {
  const sessionId = paymentRefToSession.get(ref);
  if (!sessionId) return null;
  return getSession(sessionId);
}

export function clearPaymentRef(ref: string): void {
  paymentRefToSession.delete(ref);
}
