"use client";

import { useState } from "react";
import type { RecurringPayment, Subscription } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";
import { useDrill } from "./drill-context";
import { useOverrides } from "@/lib/overrides/context";
import { ShowMoreToggle } from "./show-more";
import type { TransactionFilter } from "./transaction-list";

interface RecurringPaymentsProps {
  recurring: RecurringPayment[];
  subscriptions: Subscription[];
  rangeFrom?: string | null;
  rangeTo?: string | null;
}

export function RecurringPayments({ recurring, subscriptions, rangeFrom, rangeTo }: RecurringPaymentsProps) {
  const formatKES = useFormatMoney();
  const drill = useDrill();
  const { getRename } = useOverrides();
  const displayName = (n: string) => getRename(n) ?? n;
  const [recurringExpanded, setRecurringExpanded] = useState(false);
  const RECURRING_LIMIT = 8;
  const recurringTake = recurringExpanded ? 30 : RECURRING_LIMIT;
  if (recurring.length === 0 && subscriptions.length === 0) return null;

  const monthlySubTotal = subscriptions.reduce((s, sub) => s + sub.monthlyCost, 0);

  /** Drill filter for a recurring payment row. Prefer paybill > merchant. */
  const recurringFilter = (item: RecurringPayment): TransactionFilter => {
    if (item.recipientType === "paybill" && /^\d{5,7}$/.test(item.recipient)) {
      return { paybill: item.recipient, from: rangeFrom ?? null, to: rangeTo ?? null };
    }
    if (item.recipientType === "till" && /^\d{5,7}$/.test(item.recipient)) {
      return { till: item.recipient, from: rangeFrom ?? null, to: rangeTo ?? null };
    }
    return { merchant: item.recipient, from: rangeFrom ?? null, to: rangeTo ?? null };
  };

  const subFilter = (sub: Subscription): TransactionFilter => {
    if (sub.paybill) return { paybill: sub.paybill, from: rangeFrom ?? null, to: rangeTo ?? null };
    return { merchant: sub.name, from: rangeFrom ?? null, to: rangeTo ?? null };
  };

  return (
    <section className="rounded-3xl glass p-6 lg:p-7">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5">Repeat</p>
          <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Recurring & subs</h3>
        </div>
        {monthlySubTotal > 0 && (
          <div className="text-right">
            <p className="num-display text-2xl font-bold text-coral">{formatKES(monthlySubTotal)}</p>
            <p className="text-[10px] uppercase tracking-wider text-text-muted">per month</p>
          </div>
        )}
      </div>

      {subscriptions.length > 0 && (
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-2.5">Subscriptions</p>
          <div className="space-y-1.5">
            {subscriptions.map((sub, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  drill.open({
                    title: displayName(sub.name),
                    subtitle: sub.category ? `${sub.category} · monthly` : "Subscription",
                    filter: subFilter(sub),
                    tone: "coral",
                  })
                }
                className="flex w-full text-left items-center justify-between py-2.5 px-3.5 rounded-xl bg-white/[0.025] ring-1 ring-white/5 hover:ring-coral/30 hover:bg-white/[0.04] transition-all min-h-[52px]"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate font-medium">{displayName(sub.name)}</p>
                  {sub.category && <p className="text-[10px] text-text-muted mt-0.5">{sub.category}</p>}
                </div>
                <span className="text-sm font-semibold text-coral flex-shrink-0 ml-3 font-mono tabular-nums">
                  {formatKES(sub.monthlyCost)}<span className="text-[10px] text-text-muted">/mo</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {recurring.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-2.5">Regular payments</p>
          <div className="space-y-0.5">
            {recurring.slice(0, recurringTake).map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  drill.open({
                    title: displayName(item.recipient),
                    subtitle: `${item.frequency} · ${item.occurrences}× detected`,
                    filter: recurringFilter(item),
                    tone: "default",
                  })
                }
                className="flex w-full text-left items-center justify-between py-2.5 px-2 -mx-2 rounded-lg border-b border-white/5 last:border-0 hover:bg-white/[0.025] transition-colors min-h-[44px]"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-text-primary truncate">{displayName(item.recipient)}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{item.frequency} · {item.occurrences}×</p>
                </div>
                <span className="text-xs font-medium text-text-secondary flex-shrink-0 ml-3 font-mono tabular-nums">
                  {formatKES(item.totalSpent)}
                </span>
              </button>
            ))}
          </div>
          <ShowMoreToggle
            initial={RECURRING_LIMIT}
            total={recurring.length}
            expanded={recurringExpanded}
            onToggle={setRecurringExpanded}
          />
        </div>
      )}
    </section>
  );
}
