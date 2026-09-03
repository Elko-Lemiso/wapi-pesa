import type {
  Transaction,
  FeesBreakdown,
  InternationalTransferSummary,
  GlobalPayMerchant,
  DataAirtimeSummary,
  BalancePoint,
  IncomeStream,
  PromotionSummary,
} from "../parser/types";
import { isInvalidName, normalizeMerchantName } from "../parser/identity";

export function computeFeesBreakdown(transactions: Transaction[]): FeesBreakdown {
  let sendMoneyFees = 0;
  let paybillFees = 0;
  let merchantFees = 0;
  let withdrawalFees = 0;
  let otherFees = 0;

  // Sum up the fee field grouped by transaction type
  const totalVolume = transactions
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);

  for (const t of transactions) {
    if (t.fee <= 0) continue;

    switch (t.type) {
      case "send_money":
        sendMoneyFees += t.fee;
        break;
      case "pay_bill":
        paybillFees += t.fee;
        break;
      case "buy_goods":
      case "globalpay":
        merchantFees += t.fee;
        break;
      case "withdraw_agent":
        withdrawalFees += t.fee;
        break;
      default:
        otherFees += t.fee;
        break;
    }
  }

  const totalFees = sendMoneyFees + paybillFees + merchantFees + withdrawalFees + otherFees;

  return {
    totalFees,
    sendMoneyFees,
    paybillFees,
    merchantFees,
    withdrawalFees,
    otherFees,
    feesAsPercentage: totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0,
  };
}

export function computeInternationalTransfers(transactions: Transaction[]): InternationalTransferSummary {
  const intlTxns = transactions.filter(
    (t) => t.type === "international_transfer" && t.direction === "in"
  );

  const sourceMap = new Map<string, { total: number; count: number }>();
  for (const t of intlTxns) {
    // Bug 3: never surface a numeric/short fragment as a "source name"
    const candidate = t.counterparty.name;
    const source = candidate && !isInvalidName(candidate) ? candidate : "International Transfer";
    const existing = sourceMap.get(source) || { total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    sourceMap.set(source, existing);
  }

  const totalReceived = intlTxns.reduce((s, t) => s + t.amount, 0);
  const largest = intlTxns.reduce(
    (max, t) => {
      const candidate = t.counterparty.name;
      const sourceName = candidate && !isInvalidName(candidate) ? candidate : "International";
      return t.amount > max.amount ? { amount: t.amount, source: sourceName, date: t.completionTime } : max;
    },
    { amount: 0, source: "", date: new Date() }
  );

  return {
    totalReceived,
    transferCount: intlTxns.length,
    sources: Array.from(sourceMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total),
    averageTransfer: intlTxns.length > 0 ? totalReceived / intlTxns.length : 0,
    largestTransfer: largest,
  };
}

export function computeGlobalPayMerchants(transactions: Transaction[]): GlobalPayMerchant[] {
  const globalPayTxns = transactions.filter(
    (t) => t.type === "globalpay" && t.direction === "out"
  );

  const merchantMap = new Map<string, { country: string; total: number; count: number; lastDate: Date }>();

  for (const t of globalPayTxns) {
    // Bug 5: collapse merchant variants — Cursor / Cursor AI / Cursor Usage,
    // Netflix / Netflix.com / Netflix Los Gatos all map to one canonical name.
    const rawName = t.counterparty.name || "Unknown Merchant";
    const merchantName = normalizeMerchantName(rawName) || rawName;
    const country = extractCountryFromDetails(t.details);

    const existing = merchantMap.get(merchantName) || { country, total: 0, count: 0, lastDate: t.completionTime };
    existing.total += t.amount;
    existing.count++;
    if (t.completionTime > existing.lastDate) existing.lastDate = t.completionTime;
    if (!existing.country && country) existing.country = country;
    merchantMap.set(merchantName, existing);
  }

  return Array.from(merchantMap.entries())
    .map(([merchantName, data]) => ({ merchantName, country: data.country, totalSpent: data.total, transactionCount: data.count, lastDate: data.lastDate }))
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

function extractCountryFromDetails(details: string): string {
  // Country code is typically at the end of the last line: "0000000000   NL"
  const lines = details.split("\n");
  const lastLine = lines[lines.length - 1] || "";
  const countryMatch = lastLine.match(/\s([A-Z]{2})\s*$/);
  return countryMatch ? countryMatch[1] : "";
}

export function computeDataAirtime(transactions: Transaction[]): DataAirtimeSummary {
  let totalDataSpend = 0;
  let totalAirtimeSpend = 0;
  let dataPurchaseCount = 0;
  let airtimePurchaseCount = 0;

  for (const t of transactions) {
    if (t.direction !== "out") continue;

    if (t.type === "data_bundle") {
      totalDataSpend += t.amount;
      dataPurchaseCount++;
    } else if (t.type === "airtime") {
      totalAirtimeSpend += t.amount;
      airtimePurchaseCount++;
    }
  }

  // Estimate months from statement period
  const months = 12;

  return {
    totalDataSpend,
    totalAirtimeSpend,
    dataPurchaseCount,
    airtimePurchaseCount,
    averageDataPurchase: dataPurchaseCount > 0 ? totalDataSpend / dataPurchaseCount : 0,
    monthlyAverage: (totalDataSpend + totalAirtimeSpend) / months,
  };
}

export function computeBalanceOverTime(transactions: Transaction[]): BalancePoint[] {
  // Sort chronologically (oldest first)
  const sorted = [...transactions].sort(
    (a, b) => a.completionTime.getTime() - b.completionTime.getTime()
  );

  // Take one balance point per day (end-of-day balance = last transaction of the day)
  const dailyBalances = new Map<string, number>();
  for (const t of sorted) {
    const date = t.completionTime.toISOString().slice(0, 10);
    dailyBalances.set(date, t.balance);
  }

  return Array.from(dailyBalances.entries())
    .map(([date, balance]) => ({ date, balance }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeIncomeStreams(transactions: Transaction[]): IncomeStream[] {
  const streamMap = new Map<string, { type: IncomeStream["type"]; total: number; count: number }>();

  for (const t of transactions) {
    if (t.direction !== "in") continue;

    let source = "";
    let type: IncomeStream["type"] = "other";

    const validName = t.counterparty.name && !isInvalidName(t.counterparty.name)
      ? t.counterparty.name
      : null;

    if (t.type === "salary") {
      source = validName || "Salary";
      type = "salary";
    } else if (t.type === "international_transfer") {
      source = validName || "International Transfer";
      type = "international";
    } else if (t.type === "promotion") {
      continue; // handled separately
    } else if (t.amount >= 5000 && t.counterparty.paybillNumber) {
      source = validName || `Paybill ${t.counterparty.paybillNumber}`;
      type = "business";
    } else {
      continue;
    }

    if (!source || isInvalidName(source)) continue;

    const existing = streamMap.get(source) || { type, total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    streamMap.set(source, existing);
  }

  return Array.from(streamMap.entries())
    .map(([source, data]) => ({
      source,
      type: data.type,
      totalAmount: data.total,
      frequency: data.count,
      averageAmount: data.total / data.count,
    }))
    .filter((s) => s.frequency >= 1)
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function computePromotions(transactions: Transaction[]): PromotionSummary {
  const promoTxns = transactions.filter(
    (t) => t.type === "promotion" && t.direction === "in"
  );

  const sourceMap = new Map<string, { total: number; count: number }>();
  for (const t of promoTxns) {
    const candidate = t.counterparty.name;
    // Bug 3: drop garbage promotion names like "12T" or "012T".
    const source = candidate && !isInvalidName(candidate) ? candidate : "Promotion";
    const existing = sourceMap.get(source) || { total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    sourceMap.set(source, existing);
  }

  return {
    totalReceived: promoTxns.reduce((s, t) => s + t.amount, 0),
    count: promoTxns.length,
    sources: Array.from(sourceMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total),
  };
}
