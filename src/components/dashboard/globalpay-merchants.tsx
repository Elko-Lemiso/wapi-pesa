"use client";

import { useState } from "react";
import type { GlobalPayMerchant } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";
import { useDrill } from "./drill-context";
import { useOverrides } from "@/lib/overrides/context";
import { TermTooltip } from "./term-tooltip";
import { ShowMoreToggle } from "./show-more";

interface GlobalPayMerchantsProps {
  data: GlobalPayMerchant[];
  rangeFrom?: string | null;
  rangeTo?: string | null;
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", NL: "🇳🇱", SE: "🇸🇪", CY: "🇨🇾", MY: "🇲🇾", GB: "🇬🇧",
  DE: "🇩🇪", FR: "🇫🇷", JP: "🇯🇵", CA: "🇨🇦", AU: "🇦🇺", IE: "🇮🇪",
};

export function GlobalPayMerchants({ data, rangeFrom, rangeTo }: GlobalPayMerchantsProps) {
  const formatKES = useFormatMoney();
  const drill = useDrill();
  const { getRename } = useOverrides();
  const displayName = (n: string) => getRename(n) ?? n;
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 8;
  const take = expanded ? 30 : LIMIT;
  if (data.length === 0) return null;

  const totalSpent = data.reduce((s, m) => s + m.totalSpent, 0);
  const totalTxns = data.reduce((s, m) => s + m.transactionCount, 0);

  return (
    <section className="rounded-3xl glass p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5 text-purple-soft inline-flex items-center gap-1.5">
            GlobalPay
            <TermTooltip term="globalpay">
              <span className="sr-only">What is GlobalPay?</span>
            </TermTooltip>
          </p>
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">Global merchants</h3>
        </div>
        <div className="text-right">
          <p className="num-display text-xl font-bold text-purple">{formatKES(totalSpent)}</p>
          <p className="text-[10px] text-text-muted">{totalTxns} txns</p>
        </div>
      </div>

      <div className="space-y-0.5">
        {data.slice(0, take).map((merchant) => (
          <button
            key={merchant.merchantName}
            type="button"
            onClick={() =>
              drill.open({
                title: displayName(merchant.merchantName),
                subtitle: `${merchant.country || "International"} · ${merchant.transactionCount} GlobalPay transactions`,
                filter: {
                  paybill: "903470",
                  merchant: merchant.merchantName,
                  from: rangeFrom ?? null,
                  to: rangeTo ?? null,
                },
                tone: "purple",
              })
            }
            className="flex w-full text-left items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg border-b border-white/5 last:border-0 hover:bg-white/[0.025] transition-colors min-h-[44px]"
          >
            <span className="text-base flex-shrink-0 w-5 text-center">
              {COUNTRY_FLAGS[merchant.country] || "🌐"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-text-primary truncate font-medium">{displayName(merchant.merchantName)}</p>
              <p className="text-[10px] text-text-muted">{merchant.country || "International"} · {merchant.transactionCount}×</p>
            </div>
            <span className="text-sm font-semibold text-purple flex-shrink-0 font-mono tabular-nums">
              {formatKES(merchant.totalSpent)}
            </span>
          </button>
        ))}
      </div>
      <ShowMoreToggle
        initial={LIMIT}
        total={data.length}
        expanded={expanded}
        onToggle={setExpanded}
      />
    </section>
  );
}
