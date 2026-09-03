import type { ParsedStatement } from "./types";

export interface VerificationResult {
  passed: boolean;
  transactionCount: number;
  rawRowEstimate: number;
  totalInflows: number;
  totalOutflows: number;
  totalFees: number;
  netFlow: number;
  startingBalance: number;
  endingBalance: number;
  expectedNetFromBalance: number;
  netFlowError: number;
  warnings: string[];
}

export function verifyParsedStatement(statement: ParsedStatement): VerificationResult {
  const { transactions } = statement;
  const warnings: string[] = [];

  // Sort chronologically (oldest first)
  const sorted = [...transactions].sort(
    (a, b) => a.completionTime.getTime() - b.completionTime.getTime()
  );

  const transactionCount = sorted.length;

  // Estimate raw row count: sends have ~2 rows, merchant payments ~1, fuliza ~3
  const sendCount = sorted.filter((t) => t.fee > 0).length;
  const overdraftCount = sorted.filter((t) => t.overdraftUsed > 0).length;
  const rawRowEstimate = transactionCount + sendCount + overdraftCount;

  // Compute totals using direction/amount
  const totalInflows = sorted
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + t.amount, 0);
  const totalOutflows = sorted
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);
  const totalFees = sorted.reduce((s, t) => s + t.fee, 0);
  const netFlow = totalInflows - totalOutflows - totalFees;

  // Balance check
  const startingBalance = sorted.length > 0 ? sorted[0].balance : 0;
  const endingBalance = sorted.length > 0 ? sorted[sorted.length - 1].balance : 0;

  // The net flow should approximately equal (endingBalance - startingBalance)
  // Note: this is approximate because the "starting balance" is actually the balance
  // AFTER the first transaction, not before it. But the difference should still be small.
  const expectedNetFromBalance = endingBalance - startingBalance;
  const netFlowError = Math.abs(netFlow - expectedNetFromBalance);

  // Sanity check 1: transaction count should be reasonable
  if (transactionCount > 5000) {
    warnings.push(`High transaction count (${transactionCount}) — possible parsing issue`);
  }

  // Sanity check 2: ratio check
  const ratio = rawRowEstimate / transactionCount;
  if (ratio < 1.1) {
    warnings.push(`Row/transaction ratio too low (${ratio.toFixed(2)}) — may not be grouping fees properly`);
  }

  // Sanity check 3: if inflows ≈ outflows with tiny net AND net flow error is large, likely double-counting
  if (totalInflows > 100000 && totalOutflows > 100000) {
    const symmetryRatio = Math.abs(totalInflows - totalOutflows) / Math.max(totalInflows, totalOutflows);
    if (symmetryRatio < 0.005 && netFlowError > totalInflows * 0.1) {
      warnings.push(`Inflows ≈ Outflows (ratio ${symmetryRatio.toFixed(4)}) — possible double-counting`);
    }
  }

  // Sanity check 4: large net flow error
  if (netFlowError > 50000 && transactionCount > 100) {
    warnings.push(`Net flow (${netFlow.toFixed(0)}) differs from balance delta (${expectedNetFromBalance.toFixed(0)}) by KES ${netFlowError.toFixed(0)}`);
  }

  const passed = warnings.length === 0;

  return {
    passed,
    transactionCount,
    rawRowEstimate,
    totalInflows,
    totalOutflows,
    totalFees,
    netFlow,
    startingBalance,
    endingBalance,
    expectedNetFromBalance,
    netFlowError,
    warnings,
  };
}
