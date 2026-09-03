"use client";

import { useFormatMoney } from "@/lib/currency/context";
import { useOverrides } from "@/lib/overrides/context";
import { CATEGORIES } from "@/lib/registry/categories";
import { TransactionMenu } from "./transaction-menu";

export interface TransactionRowData {
  receiptNo: string;
  completionTime: string;
  details: string;
  amount: number;
  fee: number;
  direction: "in" | "out";
  type: string;
  balance: number;
  /** Server-supplied detected category key, when known. Used to seed the
   *  ··· menu so the user can see what we *think* this is before changing it. */
  detectedCategoryKey?: string | null;
  counterparty: {
    name: string | null;
    maskedPhone: string | null;
    paybill: string | null;
    till: string | null;
  };
}

interface TransactionRowProps {
  tx: TransactionRowData;
  /** Optional click handler — surfaces the receipt number for downstream use. */
  onClick?: (tx: TransactionRowData) => void;
  /** Hide the ··· override menu (e.g. inside the search popover preview). */
  hideMenu?: boolean;
}

export function TransactionRow({ tx, onClick, hideMenu }: TransactionRowProps) {
  const formatMoney = useFormatMoney();
  const { getTxCategory, getRename } = useOverrides();
  const date = new Date(tx.completionTime);
  const dateLabel = date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
  const timeLabel = date.toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
  });

  const renamed = getRename(tx.counterparty.name);
  const overrideCat = getTxCategory(tx.receiptNo);
  const overrideCatLabel = overrideCat ? CATEGORIES[overrideCat] : null;
  const detectedCatLabel =
    tx.detectedCategoryKey && tx.detectedCategoryKey in CATEGORIES
      ? CATEGORIES[tx.detectedCategoryKey as keyof typeof CATEGORIES]
      : null;

  const cpName =
    renamed ||
    tx.counterparty.name ||
    tx.counterparty.maskedPhone ||
    tx.counterparty.paybill ||
    tx.counterparty.till ||
    "—";
  const cpExtra = [tx.counterparty.maskedPhone, tx.counterparty.paybill, tx.counterparty.till]
    .filter(Boolean)
    .filter((s) => s !== cpName)
    .join(" · ");

  const tone = tx.direction === "in" ? "text-green" : "text-coral";
  const sign = tx.direction === "in" ? "+" : "-";

  // The row is mostly a button — except for the ··· menu which lives in the
  // top-right corner. We render that as a sibling so its click handler doesn't
  // fall through to the row click.
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick ? () => onClick(tx) : undefined}
        className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl border border-transparent transition-colors ${
          onClick ? "hover:bg-white/[0.04] hover:border-white/10 cursor-pointer" : "cursor-default"
        } min-h-[56px]`}
      >
        <div className="flex flex-col items-center gap-0.5 w-12 flex-shrink-0 text-center">
          <span className="text-[10px] uppercase tracking-wider text-text-muted leading-none">
            {dateLabel.split(" ")[1]}
          </span>
          <span className="text-base font-bold tabular-nums text-text-primary leading-none">
            {date.getDate()}
          </span>
          <span className="text-[9px] text-text-faint">{timeLabel}</span>
        </div>

        <div className="flex-1 min-w-0 pr-7">
          <p className="text-sm font-medium text-text-primary truncate flex items-center gap-1.5">
            <span className="truncate">{cpName}</span>
            {renamed && (
              <span className="inline-flex items-center text-[9px] uppercase tracking-wider text-purple-200 bg-purple/15 ring-1 ring-purple/30 px-1 py-0.5 rounded font-medium">
                renamed
              </span>
            )}
          </p>
          {cpExtra && (
            <p className="text-[11px] text-text-muted font-mono truncate">{cpExtra}</p>
          )}
          <p className="text-[11px] text-text-muted truncate mt-0.5">
            {overrideCatLabel ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-flex items-center text-[9px] uppercase tracking-wider text-purple-200 bg-purple/15 ring-1 ring-purple/30 px-1 py-0.5 rounded font-medium">
                  customised
                </span>
                <span>{overrideCatLabel}</span>
              </span>
            ) : detectedCatLabel ? (
              <span>{detectedCatLabel} · {tx.details.replace(/\s+/g, " ").slice(0, 60)}</span>
            ) : (
              <span>{tx.details.replace(/\s+/g, " ")}</span>
            )}
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-bold font-mono tabular-nums ${tone}`}>
            {sign}
            {formatMoney(tx.amount, { compact: true })}
          </p>
          {tx.fee > 0 && (
            <p className="text-[10px] text-text-faint">fee {formatMoney(tx.fee, { compact: true })}</p>
          )}
          <p className="text-[10px] text-text-faint font-mono">
            bal {formatMoney(tx.balance, { compact: true })}
          </p>
        </div>
      </button>

      {!hideMenu && (
        <div className="absolute top-2 right-2">
          <TransactionMenu tx={tx} detectedCategory={detectedCatLabel} />
        </div>
      )}
    </div>
  );
}
