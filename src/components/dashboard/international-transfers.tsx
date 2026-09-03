"use client";

import type { InternationalTransferSummary } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";
import { TermTooltip } from "./term-tooltip";

interface InternationalTransfersProps {
  data: InternationalTransferSummary;
}

export function InternationalTransfers({ data }: InternationalTransfersProps) {
  const formatKES = useFormatMoney();
  if (data.transferCount === 0) return null;

  return (
    <section className="rounded-3xl glass p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5 text-green-soft inline-flex items-center gap-1.5">
            IMTS
            <TermTooltip term="imts">
              <span className="sr-only">What is IMTS?</span>
            </TermTooltip>
          </p>
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">From abroad</h3>
        </div>
        <div className="text-right">
          <p className="num-display text-xl font-bold text-green">{formatKES(data.totalReceived)}</p>
          <p className="text-[10px] text-text-muted">{data.transferCount} transfers</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-xl bg-white/[0.025] ring-1 ring-white/5 p-3">
          <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Average</p>
          <p className="text-sm font-bold text-text-primary mt-1 font-mono tabular-nums">{formatKES(data.averageTransfer)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.025] ring-1 ring-white/5 p-3">
          <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Largest</p>
          <p className="text-sm font-bold text-gold mt-1 font-mono tabular-nums">{formatKES(data.largestTransfer.amount)}</p>
        </div>
      </div>

      {data.sources.length > 0 && (
        <div className="space-y-1.5">
          {data.sources.map((source) => (
            <div key={source.name} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green/30 to-green/10 ring-1 ring-green/25 flex items-center justify-center text-xs text-green font-bold flex-shrink-0">
                  {source.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[13px] text-text-primary truncate">{source.name}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-medium text-text-primary font-mono tabular-nums">{formatKES(source.total)}</span>
                <span className="text-[10px] text-text-muted ml-1.5">×{source.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
