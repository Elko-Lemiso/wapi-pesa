import type { Transaction, MobileLoanSummary, MobileLenderDetail } from "../parser/types";
import { LENDER_NAMES } from "../registry/categories";

const LENDER_PATTERNS: { key: string; patterns: RegExp[] }[] = [
  { key: "tala", patterns: [/\bTALA\b/i, /\b513613\b/] },
  { key: "branch", patterns: [/\bBRANCH\b/i, /\b725665\b/] },
  { key: "zenka", patterns: [/\bZENKA\b/i, /\b516516\b/] },
  { key: "okash", patterns: [/\bOKASH\b/i, /\bO-?KASH\b/i, /\b333444\b/] },
  { key: "kcb_mpesa", patterns: [/\bKCB\b.*\bM-?PESA\b/i, /\b972900\b/] },
  { key: "mshwari", patterns: [/\bM-?SHWARI\b/i] },
  { key: "fuliza", patterns: [/\bFULIZA\b/i] },
  { key: "hustler_fund", patterns: [/\bHUSTLER\b/i, /\b891300\b/] },
  { key: "timiza", patterns: [/\bTIMIZA\b/i, /\b820201\b/] },
  { key: "ipesa", patterns: [/\biPESA\b/i, /\b101010\b/] },
];

export function analyzeMobileLoans(transactions: Transaction[]): MobileLoanSummary {
  const lenderActivity = new Map<string, { borrowed: number; repaid: number; fees: number; count: number }>();

  for (const t of transactions) {
    const lender = identifyLender(t);
    if (!lender) continue;

    const existing = lenderActivity.get(lender) || { borrowed: 0, repaid: 0, fees: 0, count: 0 };

    if (t.direction === "in") {
      existing.borrowed += t.amount;
    } else {
      existing.repaid += t.amount;
    }

    existing.count++;
    lenderActivity.set(lender, existing);
  }

  const lenders: MobileLenderDetail[] = [];
  let totalBorrowed = 0;
  let totalRepaid = 0;
  let totalFees = 0;

  for (const [key, data] of lenderActivity) {
    // Estimate fees as the difference between repaid and borrowed
    const fees = Math.max(0, data.repaid - data.borrowed);

    lenders.push({
      name: LENDER_NAMES[key] || key,
      borrowed: data.borrowed,
      repaid: data.repaid,
      fees,
      transactions: data.count,
    });

    totalBorrowed += data.borrowed;
    totalRepaid += data.repaid;
    totalFees += fees;
  }

  // Effective annual rate estimation (simplified)
  let effectiveAnnualRate: number | null = null;
  if (totalBorrowed > 0 && totalFees > 0) {
    // Rough estimate assuming average loan duration of 30 days
    const monthlyRate = totalFees / totalBorrowed;
    effectiveAnnualRate = Math.round(monthlyRate * 12 * 10000) / 100;
  }

  return {
    lenders: lenders.sort((a, b) => b.borrowed - a.borrowed),
    totalBorrowed,
    totalRepaid,
    totalFees,
    effectiveAnnualRate,
  };
}

function identifyLender(t: Transaction): string | null {
  const details = t.details;
  const paybill = t.counterparty.paybillNumber;

  for (const { key, patterns } of LENDER_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(details) || (paybill && pattern.test(paybill))) {
        return key;
      }
    }
  }

  return null;
}
