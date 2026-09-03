import type { ExtractedPage } from "./pdf-decrypt";
import type { Transaction, ParsedStatement } from "./types";
import { classifyTransaction } from "./classify";

const RECEIPT_REGEX = /^[A-Za-z0-9]{10}$/;
const DATE_TIME_REGEX = /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/;
const AMOUNT_PATTERN = /(-?[\d,]+\.\d{2})/g;

export interface ReconciliationResult {
  totalInflow: number;
  totalOutflow: number;
  totalFees: number;
  computedDelta: number;
  observedDelta: number;
  discrepancy: number;
  discrepancyPct: number;
  reconciles: boolean;
}

interface RawRow {
  receiptNo: string;
  dateTime: string;
  details: string;
  status: string;
  paidIn: number;
  withdrawn: number;
  balance: number;
  index: number; // preserve statement order
}

export function extractTransactions(pages: ExtractedPage[]): ParsedStatement {
  const allLines: string[] = [];
  for (const page of pages) {
    allLines.push(...page.lines);
  }

  const accountHolder = extractAccountHolder(allLines);
  const phoneNumber = extractPhoneNumber(allLines);
  const period = extractStatementPeriod(allLines);

  // Phase 1: Parse all raw rows
  const rawRows = parseRawRows(pages);

  // Phase 2: Group by receipt number
  const groups = groupByReceipt(rawRows);

  // Phase 3+4: Classify roles within each group and emit logical transactions
  const transactions = buildLogicalTransactions(groups);

  return {
    transactions,
    accountHolder,
    phoneNumber,
    statementPeriod: period,
    currency: "KES",
  };
}

/**
 * Sanity check: sum of (inflows − outflows − fees) over the principal rows
 * should equal the change in balance from the first to the last transaction.
 *
 * Returns reconciliation data with both `reconciles` (boolean within tolerance)
 * and the raw numbers so callers can log or warn.
 *
 * Tolerance is the larger of KES 100 or 1% of total volume.
 */
export function reconcile(transactions: Transaction[]): ReconciliationResult {
  const sortedAsc = [...transactions].sort(
    (a, b) => a.completionTime.getTime() - b.completionTime.getTime()
  );
  const earliest = sortedAsc[0];
  const latest = sortedAsc[sortedAsc.length - 1];
  if (!earliest || !latest) {
    return {
      totalInflow: 0, totalOutflow: 0, totalFees: 0,
      computedDelta: 0, observedDelta: 0, discrepancy: 0, discrepancyPct: 0,
      reconciles: true,
    };
  }

  // Pre-balance of the very first transaction
  const earliestPre = earliest.direction === "out"
    ? earliest.balance + earliest.amount + earliest.fee
    : earliest.balance - earliest.amount;

  const totalInflow = transactions
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOutflow = transactions
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);
  const totalFees = transactions.reduce((s, t) => s + t.fee, 0);

  const computedDelta = totalInflow - totalOutflow - totalFees;
  const observedDelta = latest.balance - earliestPre;
  const discrepancy = observedDelta - computedDelta;

  const totalVolume = totalInflow + totalOutflow;
  const tolerance = Math.max(100, totalVolume * 0.01);
  const reconciles = Math.abs(discrepancy) <= tolerance;
  const discrepancyPct = totalVolume > 0 ? (Math.abs(discrepancy) / totalVolume) * 100 : 0;

  return {
    totalInflow,
    totalOutflow,
    totalFees,
    computedDelta,
    observedDelta,
    discrepancy,
    discrepancyPct,
    reconciles,
  };
}

function groupByReceipt(rows: RawRow[]): Map<string, RawRow[]> {
  const groups = new Map<string, RawRow[]>();
  for (const row of rows) {
    const existing = groups.get(row.receiptNo);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(row.receiptNo, [row]);
    }
  }
  return groups;
}

function buildLogicalTransactions(groups: Map<string, RawRow[]>): Transaction[] {
  const transactions: Transaction[] = [];

  for (const [receiptNo, rows] of groups) {
    // Sort rows by index to preserve statement order within a group
    rows.sort((a, b) => a.index - b.index);

    // Classify each row's role
    let principalRow: RawRow | null = null;
    let totalFee = 0;
    let totalOverdraft = 0;

    for (const row of rows) {
      const upperDetails = row.details.toUpperCase();

      if (upperDetails.includes("OVERDRAFT OF CREDIT PARTY")) {
        // Overdraft credit — NOT income, it's an internal Fuliza lending event
        totalOverdraft += row.paidIn;
      } else if (isChargeRow(upperDetails)) {
        // Fee/charge row
        totalFee += row.withdrawn;
      } else {
        // Principal row — the actual payment or receive
        // If multiple principal rows exist (rare), take the one with the largest amount
        if (!principalRow || (Math.abs(row.paidIn - row.withdrawn) > Math.abs(principalRow.paidIn - principalRow.withdrawn))) {
          principalRow = row;
        }
      }
    }

    // If no principal row found, try to use the first non-charge row
    if (!principalRow) {
      principalRow = rows.find(r => !r.details.toUpperCase().includes("OVERDRAFT OF CREDIT PARTY")) || rows[0];
    }

    const direction: "in" | "out" = principalRow.paidIn > 0 ? "in" : "out";
    const amount = direction === "in" ? principalRow.paidIn : principalRow.withdrawn;

    // Balance is from the row that appears first in the statement
    // (M-Pesa statements list most recent first, so first row has the post-transaction balance)
    const balance = rows[0].balance;

    const completionTime = parseDateTime(principalRow.dateTime);
    const { type, counterparty } = classifyTransaction(principalRow.details, principalRow.paidIn, principalRow.withdrawn);

    transactions.push({
      receiptNo,
      completionTime,
      details: principalRow.details,
      status: principalRow.status || "Completed",
      amount,
      direction,
      fee: totalFee,
      overdraftUsed: totalOverdraft,
      paidIn: principalRow.paidIn,
      withdrawn: principalRow.withdrawn,
      balance,
      type,
      counterparty,
    });
  }

  // Sort by completion time descending (most recent first, matching statement order)
  transactions.sort((a, b) => b.completionTime.getTime() - a.completionTime.getTime());

  return transactions;
}

function isChargeRow(upperDetails: string): boolean {
  // Must contain "Charge" but NOT be the main transaction that happens to mention charging
  return (
    (upperDetails.includes("CHARGE") &&
      !upperDetails.includes("PAY BILL ONLINE") &&
      !upperDetails.includes("MERCHANT PAYMENT") &&
      !upperDetails.includes("CUSTOMER TRANSFER TO") &&
      !upperDetails.includes("CARD PAY BILL")) ||
    upperDetails === "CHARGE" ||
    upperDetails.endsWith("CHARGE") ||
    upperDetails.includes("TRANSFER OF FUNDS CHARGE") ||
    upperDetails.includes("PAY BILL CHARGE") ||
    upperDetails.includes("PAY MERCHANT CHARGE")
  );
}

// ============ Phase 1: Raw row parsing ============

function parseRawRows(pages: ExtractedPage[]): RawRow[] {
  const rows: RawRow[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const { lines } = page;
    let i = 0;

    // Skip to after the header row
    while (i < lines.length) {
      if (lines[i].includes("Receipt No.") && lines[i].includes("Completion Time")) {
        i++;
        break;
      }
      i++;
    }

    while (i < lines.length) {
      const line = lines[i];

      if (isFooterLine(line)) {
        i++;
        continue;
      }

      const rowStart = tryParseRowStart(line);
      if (rowStart) {
        // Gather continuation lines (multi-line descriptions)
        const continuationLines: string[] = [];
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          if (tryParseRowStart(nextLine)) break;
          if (isFooterLine(nextLine)) { i++; continue; }
          if (nextLine.includes("Receipt No.") && nextLine.includes("Completion Time")) { i++; break; }
          continuationLines.push(nextLine);
          i++;
        }

        const fullDetails = rowStart.details +
          (continuationLines.length > 0 ? "\n" + continuationLines.join("\n") : "");

        rows.push({
          receiptNo: rowStart.receiptNo,
          dateTime: rowStart.dateTime,
          details: fullDetails.trim(),
          status: rowStart.status,
          paidIn: rowStart.paidIn,
          withdrawn: rowStart.withdrawn,
          balance: rowStart.balance,
          index: globalIndex++,
        });
      } else {
        i++;
      }
    }
  }

  return rows;
}

function isFooterLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("Disclaimer:") ||
    /^for which it was provided/i.test(trimmed) ||
    trimmed.startsWith("Statement Verification") ||
    trimmed.startsWith("For self-help") ||
    /^prompts to confirm/i.test(trimmed) ||
    /^https?:\/\//i.test(trimmed) ||
    line.includes("www.safaricom.co.ke") ||
    line.includes("conditions apply") ||
    (line.startsWith("Page ") && line.includes(" of "))
  );
}

interface RowStart {
  receiptNo: string;
  dateTime: string;
  details: string;
  status: string;
  paidIn: number;
  withdrawn: number;
  balance: number;
}

function tryParseRowStart(line: string): RowStart | null {
  const parts = line.split(/\s+/);
  if (parts.length < 3) return null;

  const receiptNo = parts[0];
  if (!RECEIPT_REGEX.test(receiptNo)) return null;

  const dateMatch = line.match(DATE_TIME_REGEX);
  if (!dateMatch) return null;

  const dateTime = `${dateMatch[1]} ${dateMatch[2]}`;
  const afterDate = line.slice(line.indexOf(dateMatch[0]) + dateMatch[0].length).trim();

  // Extract amounts from the end of the line
  const amounts = [...afterDate.matchAll(AMOUNT_PATTERN)].map((m) => m[1]);

  let paidIn = 0;
  let withdrawn = 0;
  let balance = 0;
  let detailsEnd = afterDate.length;

  if (amounts.length >= 2) {
    const lastAmt = parseAmount(amounts[amounts.length - 1]);
    const secondLastAmt = parseAmount(amounts[amounts.length - 2]);

    balance = lastAmt;
    if (secondLastAmt < 0) {
      withdrawn = Math.abs(secondLastAmt);
    } else {
      paidIn = secondLastAmt;
    }

    const firstAmountStr = amounts[amounts.length - 2];
    const amountIdx = afterDate.lastIndexOf(firstAmountStr);
    if (amountIdx > 0) {
      detailsEnd = amountIdx;
    }
  } else if (amounts.length === 1) {
    balance = parseAmount(amounts[0]);
    const amountIdx = afterDate.lastIndexOf(amounts[0]);
    if (amountIdx > 0) {
      detailsEnd = amountIdx;
    }
  }

  let details = afterDate.slice(0, detailsEnd).trim();

  // Detect and strip status
  let status = "Completed";
  if (details.includes("Completed")) {
    status = "Completed";
    details = details.replace(/\s*Completed\s*$/, "").replace(/\s*Completed\s+/, " ").trim();
  } else if (details.includes("Failed")) {
    status = "Failed";
    details = details.replace(/\s*Failed\s*$/, "").replace(/\s*Failed\s+/, " ").trim();
  }

  return { receiptNo, dateTime, details, status, paidIn, withdrawn, balance };
}

// ============ Helpers ============

function extractAccountHolder(lines: string[]): string | null {
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (lines[i].includes("Customer Name:")) {
      const match = lines[i].match(/^(.+?)\s*Customer Name:/);
      if (match) return match[1].trim();
      if (i > 0 && !lines[i - 1].includes("STATEMENT") && lines[i - 1].trim().length > 2) {
        return lines[i - 1].trim();
      }
    }
    if (i > 0 && lines[i].trim() === "Customer Name:") {
      return lines[i - 1].trim();
    }
  }
  return null;
}

function extractPhoneNumber(lines: string[]): string | null {
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (lines[i].includes("Mobile Number:")) {
      const match = lines[i].match(/(\d{10,13})/);
      if (match) return match[1];
      if (i > 0) {
        const prevMatch = lines[i - 1].match(/(\d{10,13})/);
        if (prevMatch) return prevMatch[1];
      }
    }
  }
  return null;
}

function extractStatementPeriod(lines: string[]): { from: Date; to: Date } | null {
  for (const line of lines.slice(0, 30)) {
    const match = line.match(
      /(\d{1,2}\s+\w+\s+\d{4})\s*-\s*(\d{1,2}\s+\w+\s+\d{4})/
    );
    if (match) {
      const from = new Date(match[1]);
      const to = new Date(match[2]);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        return { from, to };
      }
    }
  }
  return null;
}

function parseDateTime(dateTimeStr: string): Date {
  if (!dateTimeStr) return new Date(0);
  const d = new Date(dateTimeStr);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/,/g, "").trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}
