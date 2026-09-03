import { v4 as uuidv4 } from "uuid";
import type { AnalyticsResult, ParsedStatement } from "./parser/types";
import type { CardManifest } from "./generation/reflect-cards";

export type SessionMode = "reflect" | "understand";
export type SessionStatus =
  | "parsing"
  | "parsed"
  | "payment_pending"
  | "payment_confirmed"
  | "generating"
  | "delivered"
  | "deleted";

export type UnderstandPeriod = "single_month" | "annual";

export interface SessionData {
  id: string;
  mode: SessionMode;
  status: SessionStatus;
  createdAt: number;
  lastAccessed: number;
  analytics: AnalyticsResult | null;
  parsedStatement: ParsedStatement | null;
  paymentReference: string | null;
  reportBuffer: Buffer | null;
  cardBuffers: Map<string, Buffer> | null;
  /** Lightweight, JSON-safe description of the share cards (no buffers). */
  cardManifest: CardManifest[] | null;
  csvBuffer: Buffer | null;
  understandPeriod: UnderstandPeriod | null;
  email: string | null;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Use globalThis to persist sessions across webpack HMR recompilations in dev
const globalSessions = globalThis as unknown as {
  __mpesa_sessions?: Map<string, SessionData>;
  __mpesa_cleanup?: ReturnType<typeof setInterval>;
};

if (!globalSessions.__mpesa_sessions) {
  globalSessions.__mpesa_sessions = new Map<string, SessionData>();
}

const sessions = globalSessions.__mpesa_sessions;
let cleanupInterval: ReturnType<typeof setInterval> | null = globalSessions.__mpesa_cleanup ?? null;

function startCleanupLoop() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastAccessed > SESSION_TTL_MS) {
        destroySession(id);
      }
    }
  }, 60_000);
  globalSessions.__mpesa_cleanup = cleanupInterval;
}

export function createSession(mode: SessionMode, understandPeriod?: UnderstandPeriod): string {
  startCleanupLoop();
  const id = uuidv4();
  sessions.set(id, {
    id,
    mode,
    status: "parsing",
    createdAt: Date.now(),
    lastAccessed: Date.now(),
    analytics: null,
    parsedStatement: null,
    paymentReference: null,
    reportBuffer: null,
    cardBuffers: null,
    cardManifest: null,
    csvBuffer: null,
    understandPeriod: understandPeriod ?? null,
    email: null,
  });
  return id;
}

export function getSession(id: string): SessionData | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() - session.lastAccessed > SESSION_TTL_MS) {
    destroySession(id);
    return null;
  }
  session.lastAccessed = Date.now();
  return session;
}

export function updateSession(id: string, updates: Partial<SessionData>): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  Object.assign(session, updates, { lastAccessed: Date.now() });
  return true;
}

export function destroySession(id: string): void {
  const session = sessions.get(id);
  if (!session) return;

  // Explicitly null out sensitive buffers
  if (session.reportBuffer) {
    session.reportBuffer.fill(0);
    session.reportBuffer = null;
  }
  if (session.cardBuffers) {
    for (const buf of session.cardBuffers.values()) {
      buf.fill(0);
    }
    session.cardBuffers = null;
  }
  session.cardManifest = null;
  if (session.csvBuffer) {
    session.csvBuffer.fill(0);
    session.csvBuffer = null;
  }
  session.analytics = null;
  session.parsedStatement = null;

  sessions.delete(id);
}

export function getSessionCount(): number {
  return sessions.size;
}
