import type { TransactionType, CounterpartyInfo } from "./types";
import { lookupPaybill, lookupTill } from "../registry/paybills";
import { isInvalidName, normalizeMerchantName } from "./identity";

interface ClassificationResult {
  type: TransactionType;
  counterparty: CounterpartyInfo;
}

const MASKED_PHONE_REGEX = /((?:254|07|01)\d*?\*+\d{3})/;
const GLOBALPAY_PAYBILL = "903470";

// Lines that are conversation IDs / reference metadata — must be stripped before phone matching
const NOISE_LINE_PATTERNS = [
  /^TAM\d/,
  /^IMT/,
  /^st_[a-f0-9-]/,
  /^\d+_Remitly/,
  /^Original conversation/i,
  /^Orginal conversation/i,
  /^ID is$/i,
  /^[a-f0-9-]{20,}$/,
  /^\d{7,}_\w/,
  /^[A-Z0-9]{10,}$/,
];

export function classifyTransaction(
  details: string,
  paidIn: number,
  withdrawn: number
): ClassificationResult {
  const upperDetails = details.toUpperCase();
  const counterparty = extractCounterparty(details);

  // OD Loan Repayment (Fuliza repay)
  if (upperDetails.includes("OD LOAN REPAYMENT")) {
    return { type: "od_repayment", counterparty };
  }

  // Fuliza-assisted transactions
  if (upperDetails.includes("FULIZA")) {
    if (upperDetails.includes("PAY BILL")) return { type: "pay_bill", counterparty };
    if (upperDetails.includes("MERCHANT PAYMENT")) return { type: "buy_goods", counterparty };
    if (upperDetails.includes("CUSTOMER TRANSFER TO")) return { type: "send_money", counterparty };
    if (upperDetails.includes("CUSTOMER BUNDLE")) return { type: "data_bundle", counterparty };
    return { type: "fuliza", counterparty };
  }

  // M-Shwari
  if (upperDetails.includes("M-SHWARI") || upperDetails.includes("MSHWARI")) {
    if (upperDetails.includes("WITHDRAW") || paidIn > 0) {
      return { type: "mshwari_withdrawal", counterparty };
    }
    return { type: "mshwari_deposit", counterparty };
  }

  // KCB M-Pesa
  if (upperDetails.includes("KCB") && upperDetails.includes("M-PESA")) {
    return { type: "kcb_mpesa", counterparty };
  }

  // Card payments (GlobalPay) — must check before generic Pay Bill
  if (upperDetails.includes("CARD PAY BILL") || upperDetails.includes("GLOBALPAY")) {
    return { type: "globalpay", counterparty };
  }

  // Data bundles (before generic airtime)
  if (upperDetails.includes("BUNDLE") || upperDetails.includes("DATA BUNDLES")) {
    return { type: "data_bundle", counterparty };
  }

  // Airtime
  if (upperDetails.includes("AIRTIME") || upperDetails.includes("TOP UP") || upperDetails.includes("TOPUP")) {
    return { type: "airtime", counterparty };
  }

  // Pay Bill
  if (upperDetails.includes("PAY BILL") || upperDetails.includes("PAYBILL")) {
    return { type: "pay_bill", counterparty };
  }

  // Buy Goods / Merchant Payment
  if (upperDetails.includes("MERCHANT PAYMENT") || upperDetails.includes("BUY GOODS") || upperDetails.includes("LIPA NA M-PESA")) {
    return { type: "buy_goods", counterparty };
  }

  // Offnet transfer (Airtel Money, etc.)
  if (upperDetails.includes("OFFNET")) {
    return { type: "pay_bill", counterparty };
  }

  // Pochi La Biashara
  if (upperDetails.includes("POCHI")) {
    return { type: "pochi_la_biashara", counterparty };
  }

  // Withdraw at agent/ATM
  if ((upperDetails.includes("WITHDRAW") || upperDetails.includes("CASH OUT")) && (upperDetails.includes("AGENT") || upperDetails.includes("ATM"))) {
    return { type: "withdraw_agent", counterparty };
  }

  // Deposit at agent
  if (upperDetails.includes("DEPOSIT") && upperDetails.includes("AGENT")) {
    return { type: "deposit_agent", counterparty };
  }

  // Send money
  if (upperDetails.includes("CUSTOMER TRANSFER TO") || upperDetails.includes("SEND MONEY") || upperDetails.includes("FUNDS TRANSFER TO")) {
    return { type: "send_money", counterparty };
  }

  // Salary payments
  if (upperDetails.includes("SALARY PAYMENT FROM")) {
    return { type: "salary", counterparty };
  }

  // Promotion / cashback
  if (upperDetails.includes("PROMOTION PAYMENT FROM")) {
    return { type: "promotion", counterparty };
  }

  // International transfers
  if (upperDetails.includes("INTERNATIONAL TRANSFER") || upperDetails.includes("RECEIVE INTERNATIONAL") || upperDetails.includes("REMITLY") || upperDetails.includes("DIGITAL IMTS") || upperDetails.includes("MOBEEBANK")) {
    return { type: "international_transfer", counterparty };
  }

  // Receive money
  if (upperDetails.includes("FUNDS RECEIVED FROM") || upperDetails.includes("RECEIVED FROM")) {
    return { type: "receive_money", counterparty };
  }

  // Reversal
  if (upperDetails.includes("REVERSAL") || upperDetails.includes("REVERSED")) {
    return { type: "reversal", counterparty };
  }

  // Fallback
  if (withdrawn > 0 && counterparty.phoneNumber) return { type: "send_money", counterparty };
  if (paidIn > 0 && counterparty.phoneNumber) return { type: "receive_money", counterparty };
  if (paidIn > 0) return { type: "receive_money", counterparty };

  return { type: "unknown", counterparty };
}

function extractCounterparty(details: string): CounterpartyInfo {
  const info: CounterpartyInfo = {
    name: null,
    phoneNumber: null,
    paybillNumber: null,
    tillNumber: null,
    accountNumber: null,
  };

  // GlobalPay: paybill is 903470 but the real merchant is in the multi-line description
  if (details.toUpperCase().includes("CARD PAY BILL") || details.toUpperCase().includes("GLOBALPAY")) {
    info.paybillNumber = GLOBALPAY_PAYBILL;
    const merchantInfo = extractGlobalPayMerchant(details);
    info.name = merchantInfo.name;
    info.accountNumber = merchantInfo.reference;
    return info;
  }

  // International transfers — dedicated extraction BEFORE phone matching
  const intlResult = extractInternationalCounterparty(details);
  if (intlResult) {
    info.name = intlResult.name;
    info.paybillNumber = intlResult.paybill;
    return info;
  }

  // Promotion payments — dedicated extraction
  const promoResult = extractPromotionCounterparty(details);
  if (promoResult) {
    info.name = promoResult.name;
    info.paybillNumber = promoResult.paybill;
    return info;
  }

  // Extract paybill number — handles multi-line wrapping
  const paybillResult = extractPaybillCounterparty(details);
  if (paybillResult) {
    info.paybillNumber = paybillResult.paybillNumber;
    info.name = paybillResult.name;
    info.accountNumber = paybillResult.accountNumber;
    return info;
  }

  // Extract merchant/till number
  const merchantMatch = details.match(/(?:Merchant Payment|Buy Goods).*?(\d{4,8})\s*-\s*(.+?)(?:\n|$)/i);
  if (merchantMatch) {
    info.tillNumber = merchantMatch[1];
    info.name = merchantMatch[2].trim();
    const known = lookupTill(merchantMatch[1]);
    if (known) info.name = known.name;
    return info;
  }

  // Strip noise lines (conversation IDs, references) before phone extraction
  const cleanedDetails = stripNoiseLines(details);

  // Extract phone number (synthetic masked examples: 07******000 or 2547******111)
  const maskedPhoneMatch = cleanedDetails.match(MASKED_PHONE_REGEX);
  if (maskedPhoneMatch) {
    info.phoneNumber = maskedPhoneMatch[1];
    const phoneIdx = cleanedDetails.indexOf(maskedPhoneMatch[1]);
    const afterPhone = cleanedDetails.slice(phoneIdx + maskedPhoneMatch[1].length).trim();
    // Joined name: first line + maybe second line (M-Pesa often splits surname onto next line)
    const lines = afterPhone.split("\n").map((l) => l.trim()).filter(Boolean);
    const candidate = joinNameLines(lines);
    if (
      candidate &&
      !candidate.match(/^(Completed|Failed)/i) &&
      !isNoiseName(candidate) &&
      !isInvalidName(candidate)
    ) {
      info.name = cleanName(candidate);
    }
    return info;
  }

  // Full phone number — only match at line start or after whitespace (not embedded in IDs)
  const fullPhoneMatch = cleanedDetails.match(/(?:^|[\s,])((254|07|01)\d{8,9})(?=[\s,\n]|$)/m);
  if (fullPhoneMatch) {
    info.phoneNumber = fullPhoneMatch[1];
    const afterPhone = cleanedDetails.slice(cleanedDetails.indexOf(fullPhoneMatch[1]) + fullPhoneMatch[1].length).trim();
    const namePart = afterPhone.split("\n")[0].trim();
    if (
      namePart.length > 2 &&
      !namePart.match(/^(Completed|Failed)/i) &&
      !isNoiseName(namePart) &&
      !isInvalidName(namePart)
    ) {
      info.name = cleanName(namePart);
    }
    return info;
  }

  // Generic name extraction from "from/to" patterns (on cleaned text)
  const cleanedLines = cleanedDetails.split("\n").map(l => l.trim()).filter(Boolean);

  // Try: "from/to PAYBILL - NAME" where name may be on same line or next line
  const fromToMatch = cleanedDetails.match(/(?:from|to)\s+(\d+)\s*-\s*(.+?)(?:\n|$)/i);
  if (fromToMatch) {
    const paybill = fromToMatch[1];
    const candidate = fromToMatch[2].trim();
    if (candidate.length > 2 && !isNoiseName(candidate)) {
      info.name = cleanCounterpartyName(candidate);
      info.paybillNumber = paybill;
      return info;
    }
    // Name was noise (e.g., amount); look at the next line for the real name
    const matchLineIdx = cleanedLines.findIndex(l => l.includes(`${paybill} -`));
    if (matchLineIdx >= 0 && matchLineIdx + 1 < cleanedLines.length) {
      const nextLine = cleanedLines[matchLineIdx + 1];
      if (nextLine.length > 2 && !isNoiseName(nextLine) && !nextLine.match(/^(Completed|Failed)/i)) {
        info.name = cleanCounterpartyName(nextLine);
        info.paybillNumber = paybill;
        return info;
      }
    }
  }

  // Fallback: "from/to - NAME" (without paybill number)
  const simpleFromTo = cleanedDetails.match(/(?:from|to)\s+-\s+(.+?)(?:\s*Completed|\s*$|\n)/i);
  if (simpleFromTo && simpleFromTo[1].length > 2 && !isNoiseName(simpleFromTo[1].trim())) {
    info.name = simpleFromTo[1].trim();
    return info;
  }

  return info;
}

/**
 * Dedicated international transfer counterparty extraction.
 *
 * Format: "Receive International Zero Rated Transfer From [paybill] - [SENDER NAME].
 *          Original conversation ID is [id]. ..."
 *
 * Strategy:
 *   1. Match the SENDER NAME between "- " and the period (".") that ends the
 *      sender clause — never grab the trailing digits of the conversation ID.
 *   2. Validate the extracted name (must contain alphabetic chars and ≥3 chars).
 *      Reject digit-only fragments, hex IDs, etc.
 *   3. Fall back to known service signatures (REMITLY, DIGITAL IMTS, etc.).
 */
function extractInternationalCounterparty(details: string): { name: string; paybill: string | null } | null {
  const upper = details.toUpperCase();
  if (
    !upper.includes("INTERNATIONAL") &&
    !upper.includes("REMITLY") &&
    !upper.includes("DIGITAL IMTS") &&
    !upper.includes("MOBEEBANK") &&
    !upper.includes("WORLDREMIT") &&
    !upper.includes("WISE") &&
    !upper.includes("RECEIVE INTERNATIONAL")
  ) {
    return null;
  }

  // Single-line / wrapped: "From 4133831 - REMITLY. Original conversation..."
  // The sender name lives between the dash after the paybill and the FIRST period
  // (which closes the sender-name clause). The conversation ID lives after.
  const fullText = details.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const captureName = fullText.match(/(?:From|Transfer From)\s+(\d+)\s*-\s*([^.]+?)\.\s/i);
  if (captureName) {
    const paybill = captureName[1];
    const candidate = captureName[2].trim().replace(/\s+/g, " ");
    if (!isInvalidName(candidate)) {
      // Compact common sender names — IMTS-style senders are usually a noun phrase.
      let name = candidate;
      if (/digital imts/i.test(name)) name = "DIGITAL IMTS (MobeeBank)";
      return { name, paybill };
    }
  }

  // Single-line variant without trailing period: "From 785788 - DIGITAL IMTS"
  // (no conversation ID present yet) — be cautious to not match the trailing
  // digits of an ID that ran into the same line.
  const lineMatch = fullText.match(/(?:From|Transfer From)\s+(\d+)\s*-\s*([A-Z][A-Z0-9& ]{2,}?)(?=\s*(?:Original|conversation|MPESA|MOBEEBANK|\.|$))/i);
  if (lineMatch) {
    const paybill = lineMatch[1];
    const candidate = lineMatch[2].trim();
    if (!isInvalidName(candidate)) {
      let name = candidate;
      if (/digital imts/i.test(name)) name = "DIGITAL IMTS (MobeeBank)";
      return { name, paybill };
    }
  }

  // Known-service fallbacks — only when we have strong service signal in text.
  if (upper.includes("REMITLY")) return { name: "Remitly", paybill: "4133831" };
  if (upper.includes("DIGITAL IMTS") || upper.includes("MOBEEBANK")) return { name: "DIGITAL IMTS (MobeeBank)", paybill: "785788" };
  if (upper.includes("WISE")) return { name: "Wise", paybill: null };
  if (upper.includes("WORLDREMIT")) return { name: "WorldRemit", paybill: null };
  if (upper.includes("EQUITY") && upper.includes("IMT")) return { name: "Equity Bank IMT", paybill: null };

  return null;
}

/**
 * Dedicated promotion/cashback counterparty extraction.
 * Pattern: "Promotion Payment from\n3033815 - LOOP B2C. via API.\n..."
 *
 * Always validates the extracted name to avoid garbage like "12T" or "012T"
 * that comes from grabbing digits of a reference ID.
 */
function extractPromotionCounterparty(details: string): { name: string; paybill: string | null } | null {
  const upper = details.toUpperCase();
  if (!upper.includes("PROMOTION PAYMENT")) return null;

  const lines = details.split("\n").map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(\d+)\s*-\s*(.+?)(?:\.\s|$)/);
    if (match) {
      const candidate = match[2].trim();
      if (isInvalidName(candidate)) continue;
      return { name: candidate, paybill: match[1] };
    }
  }

  return null;
}

/**
 * Paybill extraction that handles multi-line wrapping.
 *
 * Patterns:
 *   "Pay Bill Online to 123456 - Sample Aggregator Acc. SAMPLE123" (single line)
 *   "Pay Bill Online to 234567 -\nSAMPLE BANK LIMITED. Acc.\nTESTACCOUNT" (wrapped)
 *   "Pay Bill Online to 345678 - Sample\nBank Money Transfer\nAcc. DEMOACCOUNT" (split)
 */
function extractPaybillCounterparty(details: string): { paybillNumber: string; name: string; accountNumber: string | null } | null {
  const upper = details.toUpperCase();
  if (!upper.includes("PAY BILL") && !upper.includes("PAYBILL")) return null;

  // Extract the paybill number first
  const paybillNumMatch = details.match(/(?:Pay Bill|Paybill).*?to\s+(\d{4,7})/i);
  if (!paybillNumMatch) return null;

  const paybillNumber = paybillNumMatch[1];
  const known = lookupPaybill(paybillNumber);

  // Try single-line extraction: "to 123456 - Sample Aggregator Acc. SAMPLE123"
  const singleLineMatch = details.match(/to\s+\d{4,7}\s*-\s*(.+?)(?:\s+Acc\.|\s*$|\n)/i);
  if (singleLineMatch) {
    let name = singleLineMatch[1].trim();
    // If captured name is empty or just "Completed" (stripped already) or too short, fall through
    if (name.length > 1 && !name.match(/^(Completed|Failed)$/i)) {
      // Handle mid-word split: "Co-" at end of line -> join with next line
      if (name.endsWith("-")) {
        const lines = details.split("\n");
        const lineIdx = lines.findIndex(l => l.includes(`- ${name}`) || l.includes(`-${name}`));
        if (lineIdx >= 0 && lineIdx + 1 < lines.length) {
          name = name + lines[lineIdx + 1].trim().split(/\s+Acc\./)[0];
        }
      }

      if (known) name = known.name;

      const accMatch = details.match(/Acc\.?\s*(.+?)(?:\s*$|\n)/i);
      return { paybillNumber, name, accountNumber: accMatch ? accMatch[1].trim() : null };
    }
  }

  // Multi-line: "to 234567 -\nSAMPLE BANK LIMITED. Acc.\nTESTACCOUNT"
  // The name is on the continuation line after the paybill line
  const lines = details.split("\n").map(l => l.trim()).filter(Boolean);
  const paybillLineIdx = lines.findIndex(l => l.match(/to\s+\d{4,7}\s*-\s*$/i) || l.match(/to\s+\d{4,7}\s*-\s*(?:Completed|Failed)/i));

  if (paybillLineIdx >= 0 && paybillLineIdx + 1 < lines.length) {
    let nameLine = lines[paybillLineIdx + 1];
    let accountNumber: string | null = null;

    // Extract name up to ". Acc." or "Acc."
    const accSplit = nameLine.match(/^(.+?)\s*\.?\s*Acc\.?\s*(.*)$/i);
    if (accSplit) {
      nameLine = accSplit[1].trim();
      const accValue = accSplit[2]?.trim();
      if (accValue) {
        accountNumber = accValue;
      } else if (paybillLineIdx + 2 < lines.length) {
        accountNumber = lines[paybillLineIdx + 2].trim();
      }
    } else if (paybillLineIdx + 2 < lines.length) {
      // Check if next line has account
      const nextLine = lines[paybillLineIdx + 2];
      const nextAccMatch = nextLine.match(/^Acc\.?\s*(.+)/i);
      if (nextAccMatch) accountNumber = nextAccMatch[1].trim();
    }

    // Remove trailing period from name
    nameLine = nameLine.replace(/\.\s*$/, "").trim();

    if (nameLine.length > 1) {
      const name = known ? known.name : nameLine;
      return { paybillNumber, name, accountNumber };
    }
  }

  // Final fallback: use registry or raw paybill number
  const accMatch = details.match(/Acc\.?\s*(.+?)(?:\s*$|\n)/i);
  const name = known ? known.name : `Paybill ${paybillNumber}`;
  return { paybillNumber, name, accountNumber: accMatch ? accMatch[1].trim() : null };
}

/**
 * Strip lines that are conversation IDs or reference metadata.
 */
function stripNoiseLines(details: string): string {
  const lines = details.split("\n");
  const cleaned = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    return !NOISE_LINE_PATTERNS.some(pattern => pattern.test(trimmed));
  });
  return cleaned.join("\n");
}

/**
 * Check if a candidate name is actually noise/garbage.
 */
function isNoiseName(name: string): boolean {
  if (!name) return true;
  // Pure digits or very short digit strings
  if (/^\d{1,4}$/.test(name)) return true;
  // Money amounts (e.g., "60,000.00", "7,000.00")
  if (/^-?[\d,]+\.\d{2}$/.test(name)) return true;
  // Conversation ID fragments
  if (/^[a-f0-9-]{8,}$/i.test(name)) return true;
  // Reference codes (all caps + digits, no spaces, 8+ chars)
  if (/^[A-Z0-9]{8,}$/.test(name) && !/[a-z]/.test(name)) return true;
  // Lines that are just "P1." or similar
  if (/^[A-Z]\d\.?$/.test(name)) return true;
  return false;
}

/**
 * Clean up a counterparty name — join multi-line splits, remove junk suffixes.
 */
function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\.\s*$/, "")
    .trim();
}

/**
 * Join the first 1-2 non-noise lines into a counterparty name. M-Pesa wraps
 * long names across two lines, e.g. "AMANI" / "SAMPLE". A surname
 * continuation is always SHORT (1-3 tokens) and ALL CAPS — never a sentence.
 *
 * We refuse to join when the next line:
 *   - starts with a known boilerplate word ("for which", "Disclaimer", …)
 *   - contains any lowercase letters (M-Pesa names are ALL CAPS)
 *   - is longer than 3 tokens or 30 characters
 */
function joinNameLines(lines: string[]): string {
  if (lines.length === 0) return "";
  const first = lines[0].trim();
  if (!first || isContinuationNoise(first)) return "";

  // First line: respect status / charge / noise words.
  if (/^(Completed|Failed)/i.test(first)) return "";
  if (/^Charge/i.test(first)) return "";
  if (isNoiseName(first)) return "";

  // The first line itself often contains the full name — strip any trailing
  // garbage that may have leaked in from inline status words.
  const firstClean = first
    .replace(/\s+(Completed|Failed)\b.*$/i, "")
    .replace(/\s+Charge\b.*$/i, "")
    .trim();
  const firstWords = firstClean.split(/\s+/).filter(Boolean);

  // If the first line looks complete (has 2+ all-caps tokens, or is mixed-case)
  // we're done — never paste a continuation.
  const allCaps = (s: string) => /^[A-Z][A-Z\s]*$/.test(s);
  const looksComplete = firstWords.length >= 2 || !allCaps(firstClean);
  if (looksComplete) return firstClean;

  // First line is a single ALL-CAPS first name — try to grab the surname from
  // the next line, but only if it really looks like a surname.
  const second = (lines[1] || "").trim();
  if (
    second &&
    !isContinuationNoise(second) &&
    !isNoiseName(second) &&
    !/^(Completed|Failed)/i.test(second) &&
    !/^Charge/i.test(second) &&
    !/[a-z]/.test(second) &&             // must be ALL CAPS
    second.split(/\s+/).length <= 3 &&    // not a sentence
    second.length <= 30
  ) {
    return `${firstClean} ${second}`.trim();
  }

  return firstClean;
}

/**
 * Lines that are page-footer continuations or other boilerplate that should
 * never be folded into a counterparty name.
 */
function isContinuationNoise(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^for which it was provided/i.test(trimmed) ||
    /^Disclaimer\b/i.test(trimmed) ||
    /^Statement Verification/i.test(trimmed) ||
    /^For self-help/i.test(trimmed) ||
    /^Original (?:conversation|conversational) /i.test(trimmed) ||
    /^Orginal /i.test(trimmed) ||
    /^Page \d+ of \d+/.test(trimmed) ||
    /^conditions apply/i.test(trimmed) ||
    /^www\.safaricom/.test(trimmed)
  );
}

/**
 * Clean a counterparty name — remove trailing metadata like "via API. Original conversation..."
 */
function cleanCounterpartyName(raw: string): string {
  return raw
    .replace(/\.\s*(Original|Orginal)\b.*$/i, "")
    .replace(/\s*via\s+API\s*\.?\s*$/i, "")
    .replace(/\.\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract actual merchant name from GlobalPay multi-line description.
 *
 * Statement layout:
 *   Card Pay Bill Online to 903470 - M-PESA GlobalPay Acc.
 *   <MERCHANT NAME LINE>
 *   <merchant reference / phone>   <country code>
 *
 * The merchant name itself can wrap across two physical lines (e.g.
 * "CURSOR" / "AI POWERED IDE"). We join until we hit a clear "reference" line.
 */
function extractGlobalPayMerchant(details: string): { name: string; reference: string } {
  const lines = details.split("\n").map((l) => l.trim()).filter(Boolean);

  const accLineIdx = lines.findIndex((l) => l.includes("GlobalPay Acc"));
  if (accLineIdx === -1) {
    return { name: "M-PESA GlobalPay", reference: "" };
  }

  const accLine = lines[accLineIdx];
  const afterAcc = accLine.replace(/.*GlobalPay Acc\.?\s*/, "").trim();

  // Collect merchant-name lines: from the inline-after-Acc piece (if any),
  // followed by physical lines until we hit a reference-shaped line.
  const nameParts: string[] = [];
  if (afterAcc && !looksLikeReference(afterAcc)) nameParts.push(afterAcc);

  let i = accLineIdx + 1;
  while (i < lines.length && nameParts.length < 3) {
    const ln = lines[i];
    if (looksLikeReference(ln)) break;
    nameParts.push(ln);
    i++;
  }

  const reference = lines[i] || "";

  // Build a single merchant name and canonicalise it (Bug 5: variants collapse).
  let raw = nameParts.join(" ").trim();
  if (!raw) raw = "M-PESA GlobalPay";
  const canonical = normalizeMerchantName(raw);
  return { name: canonical || raw, reference };
}

/**
 * Heuristic: a "reference" line is the merchant code / phone / country pair
 * that appears on the line after the merchant name.
 *   "+15555550123 US"
 *   "0000000000   NL"
 *   "SAMPLE01   Stockholm   SE"
 */
function looksLikeReference(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^\+?\d{6,}/.test(trimmed)) return true;            // phone-shaped
  if (/^[A-Z0-9]{6,}\s/.test(trimmed)) return true;        // ID + something
  if (/\s[A-Z]{2}\s*$/.test(trimmed)) return true;          // trailing ISO country
  if (/^[A-Z]{2}\s*$/.test(trimmed)) return true;
  return false;
}
