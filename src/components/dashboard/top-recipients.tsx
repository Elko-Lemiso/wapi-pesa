"use client";

import { useState } from "react";
import type { CounterpartySummary, PersonSendSummary } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";
import { useDrill } from "./drill-context";
import { useOverrides } from "@/lib/overrides/context";
import { ShowMoreToggle } from "./show-more";

interface TopRecipientsProps {
  byAmount: CounterpartySummary[];
  byFrequency: CounterpartySummary[];
  personSends: PersonSendSummary[];
  rangeFrom?: string | null;
  rangeTo?: string | null;
}

const COLLAPSED_LIMIT = 7;
const EXPANDED_LIMIT = 25;

export function TopRecipients({ byAmount, personSends, rangeFrom, rangeTo }: TopRecipientsProps) {
  const formatMoney = useFormatMoney();
  const drill = useDrill();
  const { getRename } = useOverrides();
  const formatKES = (n: number) => formatMoney(n, { compact: true });
  const topAmount = byAmount[0];
  const maxAmount = topAmount?.totalAmount || 1;
  const displayName = (original: string) => getRename(original) ?? original;
  const [merchantsExpanded, setMerchantsExpanded] = useState(false);
  const [peopleExpanded, setPeopleExpanded] = useState(false);

  const merchantTail = byAmount.slice(1);
  const merchantTake = merchantsExpanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT;
  const peopleTake = peopleExpanded ? EXPANDED_LIMIT : 8;

  /**
   * Build the right filter for a top-counterparty row. We prefer paybill/till
   * when present (most precise), fall back to the composite (name + masked
   * phone) contact key, and finally the merchant name as a fuzzy match.
   */
  const filterFor = (c: CounterpartySummary) => {
    if (c.paybill) return { paybill: c.paybill, from: rangeFrom ?? null, to: rangeTo ?? null };
    if (c.till) return { till: c.till, from: rangeFrom ?? null, to: rangeTo ?? null };
    if (c.maskedPhone) {
      // Build the display-form contact key the API also tries.
      return {
        contactKey: `n:${c.name.toUpperCase()}|p:${c.maskedPhone}`,
        from: rangeFrom ?? null,
        to: rangeTo ?? null,
      };
    }
    return { merchant: c.name, from: rangeFrom ?? null, to: rangeTo ?? null };
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Top by Amount */}
      <section className="rounded-3xl glass p-6 lg:p-7">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <p className="eyebrow mb-1.5 text-gold-soft">Merchants</p>
            <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Top by volume</h3>
          </div>
          <p className="text-text-muted text-[11px]">
            Top {Math.min(byAmount.length, merchantTake + 1)} of {byAmount.length}
          </p>
        </div>

        {topAmount && (
          <button
            type="button"
            onClick={() =>
              drill.open({
                title: displayName(topAmount.name),
                subtitle: `${topAmount.frequency} transactions`,
                filter: filterFor(topAmount),
                tone: "gold",
              })
            }
            className="block w-full text-left mb-5 rounded-2xl bg-white/[0.03] ring-1 ring-white/5 hover:ring-gold/30 hover:bg-white/[0.05] p-4 transition-all"
          >
            <p className="eyebrow mb-2 text-gold-soft">#1 destination · tap for transactions</p>
            <p className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight truncate">{displayName(topAmount.name)}</p>
            <p className="num-display text-2xl font-bold text-gold mt-1">{formatKES(topAmount.totalAmount)}</p>
            <p className="text-xs text-text-muted mt-0.5">{topAmount.frequency} transactions</p>
          </button>
        )}

        <div className="space-y-0.5">
          {merchantTail.slice(0, merchantTake).map((item, i) => {
            const pct = (item.totalAmount / maxAmount) * 100;
            return (
              <button
                key={i}
                type="button"
                onClick={() =>
                  drill.open({
                    title: displayName(item.name),
                    subtitle: `${item.frequency} transactions`,
                    filter: filterFor(item),
                    tone: "gold",
                  })
                }
                className="group relative flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors w-full text-left min-h-[40px]"
              >
                <span className="text-[10px] font-mono text-text-faint w-4 flex-shrink-0">
                  {String(i + 2).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-[13px] text-text-primary truncate">{displayName(item.name)}</span>
                    <span className="text-xs text-gold font-mono tabular-nums flex-shrink-0">{formatKES(item.totalAmount)}</span>
                  </div>
                  <div className="h-[3px] rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold/30 group-hover:from-gold group-hover:to-gold/50 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <ShowMoreToggle
          initial={COLLAPSED_LIMIT}
          total={merchantTail.length}
          expanded={merchantsExpanded}
          onToggle={setMerchantsExpanded}
        />
      </section>

      {/* Person-to-person */}
      <section className="rounded-3xl glass p-6 lg:p-7">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <p className="eyebrow mb-1.5 text-purple-soft">People</p>
            <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Most-sent contacts</h3>
          </div>
          <p className="text-text-muted text-[11px]">
            {personSends.length > 0 ? `Top ${Math.min(personSends.length, peopleTake)} of ${personSends.length}` : ""}
          </p>
        </div>

        {personSends.length > 0 ? (
          <div className="space-y-0.5">
            {personSends.slice(0, peopleTake).map((person, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  drill.open({
                    title: person.nameOrInitial,
                    subtitle: `${person.maskedPhone} · ${person.frequency} sends`,
                    filter: {
                      contactKey: `n:${person.nameOrInitial.toUpperCase()}|p:${person.maskedPhone}`,
                      direction: "out",
                      from: rangeFrom ?? null,
                      to: rangeTo ?? null,
                    },
                    tone: "purple",
                  })
                }
                className="flex w-full items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left min-h-[52px]"
              >
                <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-purple/30 to-purple/10 ring-1 ring-purple/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm text-purple font-bold">
                    {person.nameOrInitial.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate font-medium">{person.nameOrInitial}</p>
                  <p className="text-[10px] text-text-muted font-mono">
                    {person.maskedPhone} · {person.frequency} sends
                  </p>
                </div>
                <span className="text-sm font-bold text-purple flex-shrink-0 font-mono tabular-nums">
                  {formatKES(person.totalSent)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-text-muted">No person-to-person sends in this period.</p>
          </div>
        )}
        {personSends.length > 0 && (
          <ShowMoreToggle
            initial={8}
            total={personSends.length}
            expanded={peopleExpanded}
            onToggle={setPeopleExpanded}
          />
        )}
      </section>
    </div>
  );
}
