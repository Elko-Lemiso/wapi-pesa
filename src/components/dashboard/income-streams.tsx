"use client";

import type { IncomeStream } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";
import { useDrill } from "./drill-context";
import { useOverrides } from "@/lib/overrides/context";

interface IncomeStreamsProps {
  data: IncomeStream[];
  rangeFrom?: string | null;
  rangeTo?: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  salary: "text-green bg-green/10 ring-green/25",
  international: "text-blue-400 bg-blue-400/10 ring-blue-400/25",
  business: "text-gold bg-gold/10 ring-gold/25",
  other: "text-text-muted bg-white/5 ring-white/10",
};

const TYPE_LABELS: Record<string, string> = {
  salary: "Salary",
  international: "Intl",
  business: "Business",
  other: "Other",
};

export function IncomeStreams({ data, rangeFrom, rangeTo }: IncomeStreamsProps) {
  const formatKES = useFormatMoney();
  const drill = useDrill();
  const { getRename } = useOverrides();
  const displayName = (n: string) => getRename(n) ?? n;
  if (data.length === 0) return null;

  const totalIncome = data.reduce((s, i) => s + i.totalAmount, 0);

  return (
    <section className="rounded-3xl glass p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5 text-green-soft">Income</p>
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">Streams</h3>
        </div>
        <div className="text-right">
          <p className="num-display text-xl font-bold text-green">{formatKES(totalIncome)}</p>
          <p className="text-[10px] text-text-muted">{data.length} sources</p>
        </div>
      </div>

      <div className="space-y-0.5">
        {data.slice(0, 8).map((stream) => (
          <button
            key={stream.source}
            type="button"
            onClick={() =>
              drill.open({
                title: displayName(stream.source),
                subtitle: `${TYPE_LABELS[stream.type]} · ${stream.frequency} inflows`,
                filter: {
                  merchant: stream.source,
                  direction: "in",
                  from: rangeFrom ?? null,
                  to: rangeTo ?? null,
                },
                tone: "green",
              })
            }
            className="flex w-full text-left items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg border-b border-white/5 last:border-0 hover:bg-white/[0.025] transition-colors min-h-[44px]"
          >
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ring-1 ${TYPE_COLORS[stream.type]}`}>
              {TYPE_LABELS[stream.type]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-text-primary truncate">{displayName(stream.source)}</p>
              <p className="text-[10px] text-text-muted">{stream.frequency}× · avg {formatKES(stream.averageAmount)}</p>
            </div>
            <span className="text-sm font-semibold text-green flex-shrink-0 font-mono tabular-nums">
              {formatKES(stream.totalAmount)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
