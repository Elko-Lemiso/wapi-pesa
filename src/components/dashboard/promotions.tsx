"use client";

import type { PromotionSummary } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";

interface PromotionsProps {
  data: PromotionSummary;
}

export function Promotions({ data }: PromotionsProps) {
  const formatKES = useFormatMoney();
  if (data.count === 0) return null;

  return (
    <section className="rounded-3xl glass p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5 text-gold-soft">Free money</p>
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">Promos & cashback</h3>
        </div>
        <div className="text-right">
          <p className="num-display text-xl font-bold text-gold">{formatKES(data.totalReceived)}</p>
          <p className="text-[10px] text-text-muted">{data.count} rewards</p>
        </div>
      </div>

      {data.sources.length > 0 && (
        <div className="space-y-1.5">
          {data.sources.map((source) => (
            <div key={source.name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-full bg-gold/15 ring-1 ring-gold/25 flex items-center justify-center text-[11px] text-gold font-bold flex-shrink-0">
                  ★
                </div>
                <span className="text-[13px] text-text-primary truncate">{source.name}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-medium text-gold font-mono tabular-nums">{formatKES(source.total)}</span>
                <span className="text-[10px] text-text-muted ml-1.5">×{source.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
