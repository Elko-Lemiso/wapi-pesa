/**
 * Identity utilities used across parser, analytics, and recurring detection.
 *
 * Centralised so that contact grouping, self-transfer detection, name validation,
 * and merchant-name normalisation are consistent everywhere.
 */

// =============================================================================
// Phone normalisation
// =============================================================================

/**
 * Normalise an extracted phone string for comparison.
 * - "0700000000"      → "700000000"
 * - "254700000000"    → "700000000"
 * - "2547******000"   → "7******000"  (mask preserved)
 * - "07******000"     → "7******000"  (mask preserved)
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  // Strip non-digit-or-asterisk characters first, then known prefixes
  const cleaned = phone.replace(/[^\d*]/g, "");
  return cleaned.replace(/^254/, "").replace(/^0/, "");
}

/**
 * Returns true if a phone string is masked (contains asterisks).
 */
export function isMaskedPhone(phone: string | null | undefined): boolean {
  return !!phone && phone.includes("*");
}

/**
 * Mask a (possibly already masked) phone for safe display: 0712XX XXX 437
 */
export function maskForDisplay(phone: string): string {
  if (!phone) return phone;
  // Already masked — leave the inner asterisks but format consistently
  if (phone.includes("*")) {
    const digits = phone.replace(/[^0-9*]/g, "");
    return digits.length >= 6
      ? `${digits.slice(0, 4)}XX XXX ${digits.slice(-3)}`
      : digits;
  }
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 4)}XX XXX ${phone.slice(-3)}`;
}

// =============================================================================
// Self-transfer detection
// =============================================================================

/**
 * True if a counterparty phone string belongs to the account holder themselves.
 * Handles both full and masked phone strings.
 */
export function isSelfPhone(
  counterpartyPhone: string | null | undefined,
  ownerPhone: string | null | undefined
): boolean {
  if (!counterpartyPhone || !ownerPhone) return false;

  const cp = normalizePhone(counterpartyPhone);
  const owner = normalizePhone(ownerPhone);
  if (!cp || !owner) return false;

  // Masked: compare visible prefix and last 3 digits.
  if (cp.includes("*")) {
    const cpLast3 = cp.slice(-3);
    const ownerLast3 = owner.slice(-3);
    if (cpLast3 !== ownerLast3) return false;
    // Compare visible prefix length
    const cpPrefix = cp.split("*")[0];
    const ownerPrefix = owner.slice(0, cpPrefix.length);
    return cpPrefix === ownerPrefix;
  }

  // Full numbers — compare last 9 digits
  return cp.slice(-9) === owner.slice(-9);
}

/**
 * Tokenise a person's name into normalised words for matching.
 * Strips diacritics, punctuation, lowercases, and discards 1-letter tokens.
 */
function nameTokens(name: string | null | undefined): string[] {
  if (!name) return [];
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * True if a counterparty name plausibly refers to the account holder.
 *
 * Treat as self when:
 *   1. 2+ shared word tokens (e.g. "AMINA USER" vs "Amina Sample User"), OR
 *   2. The counterparty is a strict subset of the holder's name AND every
 *      counterparty token matches either the holder's first or last name
 *      (e.g. "AMINA" alone, when the holder is "Amina Sample User", is the
 *      account holder). This catches the common "first name only" leak
 *      case where the M-Pesa statement transcribed only one name part.
 */
export function isSelfName(
  counterpartyName: string | null | undefined,
  accountHolder: string | null | undefined
): boolean {
  if (!counterpartyName || !accountHolder) return false;

  const cp = nameTokens(counterpartyName);
  const owner = nameTokens(accountHolder);
  if (cp.length === 0 || owner.length === 0) return false;

  const ownerSet = new Set(owner);
  const overlap = cp.filter((t) => ownerSet.has(t));

  // 2+ shared words → almost certainly self.
  if (overlap.length >= 2) return true;

  // Every cp token overlaps AND the (only) overlap is a first/last name part.
  // This handles "AMINA" alone matching holder "Amina Sample User".
  if (cp.length === overlap.length && overlap.length === 1) {
    const t = overlap[0];
    if (t === owner[0] || t === owner[owner.length - 1]) return true;
  }

  return false;
}

/**
 * True if either phone-based or name-based check identifies this counterparty
 * as the account holder.
 */
export function isSelfTransfer(opts: {
  counterpartyPhone?: string | null;
  counterpartyName?: string | null;
  ownerPhone?: string | null;
  accountHolder?: string | null;
}): boolean {
  return (
    isSelfPhone(opts.counterpartyPhone, opts.ownerPhone) ||
    isSelfName(opts.counterpartyName, opts.accountHolder)
  );
}

// =============================================================================
// Composite contact key
// =============================================================================

/**
 * Build a composite contact key that prevents two distinct names from being
 * collapsed under one masked phone. This is the central fix for Bug 1.
 *
 * Order of preference:
 *   1. (name + maskedPhone)   — when both available
 *   2. maskedPhone alone       — when no usable name (won't ever collide
 *      with a named-only key)
 *   3. name alone              — paybill-only counterparties etc.
 */
export function contactKey(name: string | null | undefined, phone: string | null | undefined): string {
  const cleanName = (name || "").trim().toUpperCase();
  const cleanPhone = (phone || "").trim();

  if (cleanName && cleanPhone) return `n:${cleanName}|p:${cleanPhone}`;
  if (cleanPhone) return `p:${cleanPhone}`;
  if (cleanName) return `n:${cleanName}`;
  return "anon";
}

// =============================================================================
// Name validation (Bug 3)
// =============================================================================

/**
 * True if a candidate counterparty/source name is garbage we should never
 * surface in the UI. Returns true for things like:
 *   - "22", "037", "012T", "099"  — fragments of conversation IDs
 *   - "x", "?", ""                 — too short
 *   - "60,000.00", "abcdef-1234"   — numeric or hex fragments
 *   - strings with no alphabetic character at all
 */
export function isInvalidName(name: string | null | undefined): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  if (!/[A-Za-z]/.test(trimmed)) return true;
  // Pure digits with optional single trailing char (e.g. "012T")
  if (/^\d+[A-Za-z]?$/.test(trimmed)) return true;
  // Money-amount looking
  if (/^-?[\d,]+\.\d{2}$/.test(trimmed)) return true;
  // UUID-ish hex blob
  if (/^[a-f0-9-]{8,}$/i.test(trimmed) && !/[ghijklmnopqrstuvwxyz]/i.test(trimmed)) return true;
  return false;
}

// =============================================================================
// Merchant name normalisation (Bug 5)
// =============================================================================

/**
 * Canonicalise a merchant name so variants collapse into one.
 *
 *   "NETFLIX.COM"                     → "Netflix"
 *   "Netflix.com Los Gatos"           → "Netflix"
 *   "NETFLIX"                         → "Netflix"
 *   "CURSOR, AI POWERED IDE"          → "Cursor"
 *   "CURSOR AI POWERED IDE"           → "Cursor"
 *   "CURSOR USAGE MID AUG"            → "Cursor"
 *   "GOOGLE *YouTubePremium"          → "YouTube Premium"
 *   "Spotify Stockholm SE"            → "Spotify"
 *   "SUNO"                            → "Suno"
 *   "ANTHROPIC"                       → "Anthropic"
 *   "OPENAI"                          → "OpenAI"
 */
export function normalizeMerchantName(raw: string | null | undefined): string {
  if (!raw) return "";

  let s = raw
    .replace(/\s+/g, " ")
    .replace(/[,.]+\s*$/, "")
    .trim();

  // Fast path: known canonical mappings (case-insensitive prefix/contains).
  const upper = s.toUpperCase();
  for (const { match, canonical } of CANONICAL_MERCHANTS) {
    if (match.test(upper)) return canonical;
  }

  // Strip common noise suffixes: domain, city/country tags, payment processor noise
  s = s.replace(/\.(COM|CO|IO|AI|NET|ORG)\b.*/i, "");
  s = s.replace(/\bLOS GATOS\b.*/i, "");
  s = s.replace(/\bSAN FRANCISCO\b.*/i, "");
  s = s.replace(/\bSTOCKHOLM\b.*/i, "");
  s = s.replace(/\bLONDON\b.*/i, "");
  s = s.replace(/\b[A-Z]{2}\s*$/i, ""); // trailing 2-letter country code
  s = s.replace(/\s+\d{4,}$/g, ""); // trailing reference numbers
  s = s.replace(/\*+/g, " ");       // GOOGLE*YouTubePremium → GOOGLE YouTubePremium
  s = s.replace(/\s+/g, " ").trim();

  if (!s) return raw;

  // Title-case ALL CAPS strings, otherwise leave mixed-case names alone.
  if (s === s.toUpperCase() && /[A-Z]{3,}/.test(s)) {
    s = s
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return s;
}

interface CanonicalEntry {
  match: RegExp;
  canonical: string;
}

const CANONICAL_MERCHANTS: CanonicalEntry[] = [
  { match: /\bNETFLIX\b/, canonical: "Netflix" },
  { match: /\bSPOTIFY\b/, canonical: "Spotify" },
  { match: /\bSHOWMAX\b/, canonical: "Showmax" },
  { match: /\bYOUTUBE\b/, canonical: "YouTube Premium" },
  { match: /\bYOUTUBEPREMIUM\b/, canonical: "YouTube Premium" },
  { match: /\bDISNEY\b/, canonical: "Disney+" },
  { match: /\bAMAZON PRIME\b/, canonical: "Amazon Prime" },

  { match: /\bAPPLE\.?COM\b|\bAPPLE INC\b|\bITUNES\b/, canonical: "Apple" },
  { match: /\bGOOGLE\b/, canonical: "Google" },
  { match: /\bMICROSOFT\b|\bMSFT\b/, canonical: "Microsoft" },
  { match: /\bADOBE\b/, canonical: "Adobe" },
  { match: /\bCANVA\b/, canonical: "Canva" },

  { match: /\bCLAUDE\b/, canonical: "Claude" },
  { match: /\bANTHROPIC\b/, canonical: "Anthropic" },
  { match: /\bCHATGPT\b/, canonical: "ChatGPT" },
  { match: /\bOPENAI\b/, canonical: "OpenAI" },
  { match: /\bCURSOR\b/, canonical: "Cursor" },
  { match: /\bSUNO\b/, canonical: "Suno" },
  { match: /\bGITHUB\b/, canonical: "GitHub" },
  { match: /\bVERCEL\b/, canonical: "Vercel" },
  { match: /\bFIGMA\b/, canonical: "Figma" },
  { match: /\bNOTION\b/, canonical: "Notion" },

  { match: /\bUBER\b/, canonical: "Uber" },
  { match: /\bBOLT\b/, canonical: "Bolt" },
  { match: /\bAIRBNB\b/, canonical: "Airbnb" },
  { match: /\bBOOKING\.?COM\b/, canonical: "Booking.com" },

  { match: /\bALIEXPRESS\b/, canonical: "AliExpress" },
  { match: /\bAMAZON\b/, canonical: "Amazon" },

  { match: /\bREMITLY\b/, canonical: "Remitly" },
  { match: /\bWISE\b|\bTRANSFERWISE\b/, canonical: "Wise" },
  { match: /\bWORLDREMIT\b/, canonical: "WorldRemit" },
];
