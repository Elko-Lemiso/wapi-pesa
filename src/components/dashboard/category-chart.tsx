"use client";

import type { CategorySpending } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";
import { useDrill } from "./drill-context";

const COLORS = [
  "#ff6a4a", "#f5b731", "#00d68f", "#8b5cf6",
  "#3b82f6", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16",
];

interface CategoryChartProps {
  data: CategorySpending[];
  /** Optional active range — passed to drill-down so the panel respects it. */
  rangeFrom?: string | null;
  rangeTo?: string | null;
}

export function CategoryChart({ data, rangeFrom, rangeTo }: CategoryChartProps) {
  const formatMoney = useFormatMoney();
  const drill = useDrill();
  const formatKES = (n: number) => formatMoney(n, { compact: true });
  const items = data.slice(0, 8);
  const total = items.reduce((s, x) => s + x.total, 0) || 1;
  const maxAmount = items[0]?.total || 1;

  return (
    <section className="rounded-3xl glass p-6 lg:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5">Categories</p>
          <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Where it goes</h3>
        </div>
        <p className="text-text-muted text-[11px]">{items.length > 0 ? `Top ${items.length} · tap a row` : ""}</p>
      </div>

      {items.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-text-muted">No outflows in this range.</p>
          <p className="text-[11px] text-text-faint mt-1.5">Try widening the time window.</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        {items.map((item, i) => {
          const pct = (item.total / maxAmount) * 100;
          const sharePct = Math.round((item.total / total) * 100);
          const color = COLORS[i % COLORS.length];
          return (
            <button
              key={item.category}
              type="button"
              onClick={() =>
                drill.open({
                  title: item.category,
                  subtitle: `${item.transactionCount} transactions`,
                  filter: {
                    category: item.category,
                    direction: "out",
                    from: rangeFrom ?? null,
                    to: rangeTo ?? null,
                  },
                  tone: "coral",
                })
              }
              className="group block w-full text-left rounded-xl px-2.5 py-2 hover:bg-white/[0.03] transition-colors min-h-[48px]"
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[13px] text-text-primary truncate">{item.category}</span>
                  <span className="text-[10px] text-text-faint font-mono tabular-nums flex-shrink-0">
                    {sharePct}%
                  </span>
                </div>
                <span className="text-xs text-text-secondary font-mono tabular-nums tracking-tight ml-3 flex-shrink-0">
                  {formatKES(item.total)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 group-hover:brightness-125"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}dd)`,
                    boxShadow: `0 0 12px ${color}40`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
