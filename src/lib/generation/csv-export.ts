import type { Transaction, ParsedStatement } from "../parser/types";
import { lookupPaybill, lookupTill } from "../registry/paybills";
import { CATEGORIES, type Category } from "../registry/categories";

export function generateCSV(statement: ParsedStatement): Buffer {
  const headers = [
    "Receipt No",
    "Date",
    "Time",
    "Type",
    "Direction",
    "Category",
    "Recipient/Sender",
    "Paybill/Till",
    "Amount (KES)",
    "Fee (KES)",
    "Balance (KES)",
    "Status",
  ];

  const rows: string[][] = [headers];

  for (const t of statement.transactions) {
    const category = resolveCategory(t);
    const date = t.completionTime.toLocaleDateString("en-GB");
    const time = t.completionTime.toLocaleTimeString("en-GB", { hour12: false });

    rows.push([
      t.receiptNo,
      date,
      time,
      formatType(t.type),
      t.direction === "in" ? "In" : "Out",
      category,
      t.counterparty.name || maskPhone(t.counterparty.phoneNumber) || "—",
      t.counterparty.paybillNumber || t.counterparty.tillNumber || "—",
      t.amount.toFixed(2),
      t.fee > 0 ? t.fee.toFixed(2) : "",
      t.balance.toFixed(2),
      t.status,
    ]);
  }

  const csvContent = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return Buffer.from(csvContent, "utf-8");
}

function resolveCategory(t: Transaction): string {
  if (t.counterparty.paybillNumber && t.counterparty.paybillNumber !== "903470") {
    const entry = lookupPaybill(t.counterparty.paybillNumber);
    if (entry) return CATEGORIES[entry.category as Category] || entry.category;
  }
  if (t.counterparty.tillNumber) {
    const entry = lookupTill(t.counterparty.tillNumber);
    if (entry) return CATEGORIES[entry.category as Category] || entry.category;
  }

  switch (t.type) {
    case "send_money": return "Person-to-Person";
    case "receive_money": return "Person-to-Person";
    case "airtime":
    case "data_bundle": return "Airtime & Data";
    case "withdraw_agent":
    case "deposit_agent": return "Agent Transactions";
    case "fuliza":
    case "od_repayment":
    case "mshwari_deposit":
    case "mshwari_withdrawal":
    case "kcb_mpesa": return "Banking & Lending";
    case "globalpay": return "Subscriptions";
    case "international_transfer": return "International";
    case "salary": return "Salary";
    case "promotion": return "Promotion";
    default: return "Uncategorized";
  }
}

function formatType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 4)}XX XXX ${phone.slice(-3)}`;
}
