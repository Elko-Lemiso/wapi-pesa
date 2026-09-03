"use client";

import type { AnalyticsResult } from "@/lib/parser/types";
import { useCurrency, useFormatMoney } from "@/lib/currency/context";

interface OverviewCardsProps {
  analytics: AnalyticsResult;
  /** Equally-long previous-period analytics, when available. Drives ↑/↓ deltas. */
  previous?: AnalyticsResult | null;
}

export function OverviewCards({ analytics, previous }: OverviewCardsProps) {
  const formatMoney = useFormatMoney();
  const { symbol } = useCurrency();
  const netPositive = analytics.netFlow >= 0;
  const inOutRatio = analytics.totalOutflows > 0
    ? Math.round((analytics.totalInflows / analytics.totalOutflows) * 100)
    : 0;

  const days = Math.max(daysBetween(analytics.period?.from, analytics.period?.to), 1);
  const avgPerDay = analytics.totalOutflows / days;
  const prevAvgPerDay = previous
    ? previous.totalOutflows / Math.max(daysBetween(previous.period?.from, previous.period?.to), 1)
    : null;

  const netDelta = previous ? deltaPct(analytics.netFlow, previous.netFlow) : null;
  const inDelta = previous ? deltaPct(analytics.totalInflows, previous.totalInflows) : null;
  const outDelta = previous ? deltaPct(analytics.totalOutflows, previous.totalOutflows) : null;
  const txDelta = previous ? deltaPct(analytics.transactionCount, previous.transactionCount) : null;
  const avgDelta = prevAvgPerDay !== null ? deltaPct(avgPerDay, prevAvgPerDay) : null;

  return (
    <section className="grid lg:grid-cols-12 gap-4">
      {/* Hero card: Net flow */}
      <div className="lg:col-span-6 relative overflow-hidden rounded-3xl glass-strong p-7 lg:p-9">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-50"
          style={{
            background: netPositive
              ? "radial-gradient(circle, rgba(0,214,143,0.45), transparent 60%)"
              : "radial-gradient(circle, rgba(255,106,74,0.45), transparent 60%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <p className="eyebrow">Net flow</p>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              netPositive ? "bg-green/10 text-green ring-1 ring-green/25" : "bg-coral/10 text-coral ring-1 ring-coral/25"
            }`}>
              {netPositive ? "↑" : "↓"} {netPositive ? "Positive" : "Negative"}
            </span>
          </div>
          <p className={`num-display text-5xl sm:text-6xl lg:text-7xl font-bold mb-2 ${
            netPositive ? "text-gradient-cool" : "text-gradient-coral"
          }`}>
            {netPositive ? "+" : "-"}{formatMoney(Math.abs(analytics.netFlow))}
          </p>
          <p className="text-text-secondary text-sm">
            {netPositive
              ? `You finished the period ${formatMoney(Math.abs(analytics.netFlow), { compact: true })} ahead.`
              : `You spent ${formatMoney(Math.abs(analytics.netFlow), { compact: true })} more than you earned.`}
          </p>
          {netDelta && (
            <p className="text-[11px] text-text-muted mt-2">
              <DeltaPill delta={netDelta} positiveIsGood={true} /> vs previous period
            </p>
          )}

          {/* In/Out ratio bar */}
          <div className="mt-7">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-text-muted">In vs Out ratio</span>
              <span className="text-text-secondary font-mono tabular-nums">{inOutRatio}%</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green to-emerald-500"
                style={{ width: `${Math.min(inOutRatio, 200) / 2}%` }}
              />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
            </div>
          </div>
        </div>
      </div>

      {/* Side stats — stacked 2x2 on lg */}
      <div className="lg:col-span-6 grid grid-cols-2 gap-4">
        <StatTile
          label="Money in"
          value={formatMoney(analytics.totalInflows, { compact: true })}
          accent="green"
          icon={<ArrowDown />}
          delta={inDelta}
          positiveIsGood
        />
        <StatTile
          label="Money out"
          value={formatMoney(analytics.totalOutflows, { compact: true })}
          accent="coral"
          icon={<ArrowUp />}
          delta={outDelta}
          positiveIsGood={false}
        />
        <StatTile
          label="Transactions"
          value={analytics.transactionCount.toLocaleString()}
          accent="gold"
          icon={<TxIcon />}
          delta={txDelta}
          positiveIsGood
        />
        <StatTile
          label="Avg / day"
          value={formatMoney(avgPerDay, { compact: true })}
          unit={`${symbol} out`}
          accent="purple"
          icon={<DayIcon />}
          delta={avgDelta}
          positiveIsGood={false}
        />
      </div>
    </section>
  );
}

interface Delta {
  pct: number;
  rawDirection: "up" | "down" | "flat";
}

function deltaPct(current: number, previous: number): Delta | null {
  if (previous === 0) {
    if (current === 0) return { pct: 0, rawDirection: "flat" };
    return null; // can't divide by zero — skip the chip
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 1) return { pct: 0, rawDirection: "flat" };
  return {
    pct: Math.round(Math.abs(pct)),
    rawDirection: pct > 0 ? "up" : "down",
  };
}

function DeltaPill({ delta, positiveIsGood }: { delta: Delta; positiveIsGood: boolean }) {
  if (delta.rawDirection === "flat") {
    return (
      <span className="inline-flex items-center gap-1 text-text-muted">
        <span aria-hidden>→</span>flat
      </span>
    );
  }
  const isUp = delta.rawDirection === "up";
  const good = positiveIsGood ? isUp : !isUp;
  const cls = good ? "text-green" : "text-coral";
  return (
    <span className={`inline-flex items-center gap-1 ${cls} font-mono tabular-nums`}>
      <span aria-hidden>{isUp ? "↑" : "↓"}</span>
      {delta.pct}%
    </span>
  );
}

function daysBetween(from?: string | Date, to?: string | Date): number {
  if (!from || !to) return 365;
  const f = new Date(from).getTime();
  const t = new Date(to).getTime();
  return Math.max(1, Math.round((t - f) / (1000 * 60 * 60 * 24)));
}

function StatTile({
  label,
  value,
  unit,
  accent,
  icon,
  delta,
  positiveIsGood,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: "green" | "coral" | "gold" | "purple";
  icon: React.ReactNode;
  delta?: Delta | null;
  positiveIsGood?: boolean;
}) {
  const colorMap = {
    green: { text: "text-green", bg: "bg-green/10", ring: "ring-green/25", glow: "rgba(0,214,143,0.25)" },
    coral: { text: "text-coral", bg: "bg-coral/10", ring: "ring-coral/25", glow: "rgba(255,106,74,0.25)" },
    gold: { text: "text-gold", bg: "bg-gold/10", ring: "ring-gold/25", glow: "rgba(245,183,49,0.22)" },
    purple: { text: "text-purple", bg: "bg-purple/10", ring: "ring-purple/25", glow: "rgba(139,92,246,0.25)" },
  } as const;
  const c = colorMap[accent];

  return (
    <div className="relative overflow-hidden rounded-2xl glass p-5 group hover:-translate-y-0.5 transition-transform">
      <div
        aria-hidden
        className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"
        style={{ background: `radial-gradient(circle, ${c.glow}, transparent 60%)` }}
      />
      <div className="relative flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="eyebrow">{label}</span>
          <div className={`w-7 h-7 rounded-lg ${c.bg} ring-1 ${c.ring} flex items-center justify-center ${c.text}`}>
            {icon}
          </div>
        </div>
        <div className="mt-auto">
          {unit && (
            <span className="text-text-muted text-[11px] uppercase tracking-wider mr-1.5">{unit}</span>
          )}
          <span className={`num-display text-2xl lg:text-3xl font-bold ${c.text}`}>{value}</span>
          {delta && (
            <p className="text-[10px] text-text-muted mt-1.5">
              <DeltaPill delta={delta} positiveIsGood={positiveIsGood ?? true} /> vs prev
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ArrowDown() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v9m0 0L3 7m4 4l4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function ArrowUp() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12V3m0 0L3 7m4-4l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function TxIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4.5h10M2 9.5h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>;
}
function DayIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" /><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
