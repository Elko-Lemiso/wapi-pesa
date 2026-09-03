import type { Category } from "./categories";

/**
 * Layer 2 (GlobalPay merchant extraction) — registry mapping the canonical
 * merchant name produced by `normalizeMerchantName` to a category.
 *
 * Match keys are CASE-INSENSITIVE substring matches. The first match wins,
 * so order more specific names before less specific ones.
 */
interface GlobalPayMerchantEntry {
  match: RegExp;
  canonical: string;
  category: Category;
}

const REGISTRY: GlobalPayMerchantEntry[] = [
  // ============ STREAMING / SUBSCRIPTIONS ============
  { match: /\bNETFLIX\b/i, canonical: "Netflix", category: "subscriptions" },
  { match: /\bSPOTIFY\b/i, canonical: "Spotify", category: "subscriptions" },
  { match: /\bSHOWMAX\b/i, canonical: "Showmax", category: "subscriptions" },
  { match: /\bYOUTUBE\b/i, canonical: "YouTube Premium", category: "subscriptions" },
  { match: /\bDISNEY\b/i, canonical: "Disney+", category: "subscriptions" },
  { match: /\bAMAZON PRIME\b/i, canonical: "Amazon Prime", category: "subscriptions" },
  { match: /\bAUDIBLE\b/i, canonical: "Audible", category: "subscriptions" },
  { match: /\bSUNO\b/i, canonical: "Suno", category: "subscriptions" },

  // ============ SOFTWARE ============
  { match: /\bANTHROPIC\b/i, canonical: "Anthropic", category: "subscriptions" },
  { match: /\bCLAUDE\b/i, canonical: "Claude", category: "subscriptions" },
  { match: /\bOPENAI\b/i, canonical: "OpenAI", category: "subscriptions" },
  { match: /\bCHATGPT\b/i, canonical: "ChatGPT", category: "subscriptions" },
  { match: /\bCURSOR\b/i, canonical: "Cursor", category: "subscriptions" },
  { match: /\bGITHUB\b/i, canonical: "GitHub", category: "subscriptions" },
  { match: /\bGITLAB\b/i, canonical: "GitLab", category: "subscriptions" },
  { match: /\bVERCEL\b/i, canonical: "Vercel", category: "subscriptions" },
  { match: /\bFIGMA\b/i, canonical: "Figma", category: "subscriptions" },
  { match: /\bNOTION\b/i, canonical: "Notion", category: "subscriptions" },
  { match: /\bADOBE\b/i, canonical: "Adobe", category: "subscriptions" },
  { match: /\bCANVA\b/i, canonical: "Canva", category: "subscriptions" },
  { match: /\bDROPBOX\b/i, canonical: "Dropbox", category: "subscriptions" },
  { match: /\bSLACK\b/i, canonical: "Slack", category: "subscriptions" },
  { match: /\bLINEAR\b/i, canonical: "Linear", category: "subscriptions" },

  // ============ BIG TECH ============
  { match: /\bAPPLE\b/i, canonical: "Apple", category: "subscriptions" },
  { match: /\bGOOGLE\b/i, canonical: "Google", category: "subscriptions" },
  { match: /\bMICROSOFT\b|\bMSFT\b/i, canonical: "Microsoft", category: "subscriptions" },

  // ============ TRAVEL ============
  { match: /\bAIRBNB\b/i, canonical: "Airbnb", category: "shopping" },
  { match: /\bBOOKING\.?COM\b/i, canonical: "Booking.com", category: "shopping" },
  { match: /\bUBER\b/i, canonical: "Uber", category: "transport" },
  { match: /\bBOLT\b/i, canonical: "Bolt", category: "transport" },

  // ============ SHOPPING ============
  { match: /\bAMAZON\b/i, canonical: "Amazon", category: "shopping" },
  { match: /\bALIEXPRESS\b/i, canonical: "AliExpress", category: "shopping" },
  { match: /\bSHEIN\b/i, canonical: "Shein", category: "shopping" },
  { match: /\bEBAY\b/i, canonical: "eBay", category: "shopping" },

  // ============ REMITTANCE ============
  { match: /\bWISE\b|\bTRANSFERWISE\b/i, canonical: "Wise", category: "personal" },
  { match: /\bPAYPAL\b/i, canonical: "PayPal", category: "personal" },
];

export interface GlobalPayLookupResult {
  canonical: string;
  category: Category;
}

/**
 * Look up the category for a GlobalPay merchant name (any variant). Returns
 * null if no canonical match is found.
 */
export function lookupGlobalPayMerchant(rawName: string): GlobalPayLookupResult | null {
  if (!rawName) return null;
  for (const entry of REGISTRY) {
    if (entry.match.test(rawName)) {
      return { canonical: entry.canonical, category: entry.category };
    }
  }
  return null;
}

export function getAllGlobalPayMerchants(): GlobalPayMerchantEntry[] {
  return REGISTRY;
}
