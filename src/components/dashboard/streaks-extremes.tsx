"use client";

import type { StreakInfo, Extremes } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";

interface StreaksExtremesProps {
  streaks: StreakInfo;
  extremes: Extremes;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export function StreaksExtremes({ streaks, extremes }: StreaksExtremesProps) {
  const formatMoney = useFormatMoney();
  const formatKES = (n: number) => formatMoney(n, { compact: true });
  return (
    <section className="rounded-3xl glass p-6 lg:p-7">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <p className="eyebrow mb-1.5">Records</p>
          <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Highs, lows & streaks</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <BentoTile
          label="Longest streak"
          value={`${streaks.longestConsecutiveDays}`}
          unit="days"
          sub="Consecutive active days"
          accent="green"
        />
        <BentoTile
          label="Busiest day"
          value={`${streaks.busiestDay.count}`}
          unit="txns"
          sub={streaks.busiestDay.date}
          accent="coral"
        />
        <BentoTile
          label="Biggest send"
          value={formatKES(extremes.biggestSingleTransaction.amount)}
          sub={`To ${extremes.biggestSingleTransaction.recipient}`}
          accent="gold"
          big
        />
        <BentoTile
          label="Biggest inflow"
          value={formatKES(extremes.biggestInflow.amount)}
          sub={`${extremes.biggestInflow.source} · ${formatDate(extremes.biggestInflow.date)}`}
          accent="green"
          big
        />
        <BentoTile
          label="Busiest month"
          value={streaks.busiestMonth.month}
          sub={`${streaks.busiestMonth.count} transactions`}
          accent="purple"
        />
        <BentoTile
          label="Quietest month"
          value={streaks.quietestMonth.month}
          sub={`${streaks.quietestMonth.count} transactions`}
          accent="muted"
        />
      </div>
    </section>
  );
}

function BentoTile({
  label,
  value,
  unit,
  sub,
  accent,
  big = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  accent: "green" | "coral" | "gold" | "purple" | "muted";
  big?: boolean;
}) {
  const colorMap = {
    green: { text: "text-green", glow: "rgba(0,214,143,0.2)" },
    coral: { text: "text-coral", glow: "rgba(255,106,74,0.2)" },
    gold: { text: "text-gold", glow: "rgba(245,183,49,0.2)" },
    purple: { text: "text-purple", glow: "rgba(139,92,246,0.2)" },
    muted: { text: "text-text-secondary", glow: "rgba(148,163,184,0.08)" },
  } as const;
  const c = colorMap[accent];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/[0.025] ring-1 ring-white/5 p-4 hover:ring-white/15 transition-all">
      <div
        aria-hidden
        className="absolute -bottom-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-50"
        style={{ background: `radial-gradient(circle, ${c.glow}, transparent 60%)` }}
      />
      <div className="relative">
        <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted mb-2">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className={`num-display font-bold tracking-tight ${c.text} ${big ? "text-2xl lg:text-3xl" : "text-xl lg:text-2xl"}`}>
            {value}
          </p>
          {unit && <span className="text-[11px] text-text-muted">{unit}</span>}
        </div>
        <p className="text-[10px] text-text-muted truncate mt-1.5">{sub}</p>
      </div>
    </div>
  );
}
