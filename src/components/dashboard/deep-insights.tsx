"use client";

import type {
  DisposableIncomeInsight,
  IncomePredictabilityInsight,
  FragilityDayInsight,
  RunwayInsight,
  LifestyleCreepInsight,
  InflationExposureInsight,
  LeakTotalInsight,
  TrajectoryInsight,
  CounterpartyDirectionInsight,
  CashFlowForecastInsight,
} from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";
import { TermTooltip } from "./term-tooltip";
import type { GlossaryKey } from "@/lib/glossary";

/** Returns full + compact formatters bound to the current currency. */
function useFormatters() {
  const fm = useFormatMoney();
  return {
    formatKES: (n: number) => fm(Math.abs(n)),
    formatKESCompact: (n: number) => fm(n, { compact: true }),
  };
}

function InsightCard({
  title,
  hint,
  term,
  children,
}: {
  title: string;
  hint?: string;
  term?: GlossaryKey;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl glass p-5 lg:p-6 hover:ring-1 hover:ring-white/10 transition-all">
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted truncate">{title}</p>
          {term && <TermTooltip term={term}><span className="sr-only">{title} explanation</span></TermTooltip>}
        </div>
        {hint && <p className="text-[10px] text-text-faint flex-shrink-0">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// === 1. Disposable Income ===

export function DisposableIncomeCard({ data }: { data: DisposableIncomeInsight }) {
  const { formatKES } = useFormatters();
  return (
    <InsightCard title="Real disposable income" term="real_disposable_income">
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="num-display text-3xl font-bold text-gradient-cool">{formatKES(data.disposableIncome)}</span>
        <span className="text-[11px] text-text-muted">/mo</span>
      </div>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        What&apos;s left after fixed obligations, before discretionary spending.
      </p>
      <div className="space-y-1.5">
        <Row label="Monthly income" value={formatKES(data.monthlyIncome)} />
        <Row label="Fixed obligations" value={formatKES(data.monthlyObligations)} accent="text-coral" />
        {data.obligationBreakdown.slice(0, 5).map((o) => (
          <Row key={o.name} label={o.name} value={formatKES(o.amount)} indent />
        ))}
      </div>
    </InsightCard>
  );
}

// === 2. Income Predictability ===

export function IncomePredictabilityCard({ data }: { data: IncomePredictabilityInsight }) {
  const { formatKES } = useFormatters();
  const labelColor =
    data.label === "stable" ? "text-green" : data.label === "variable" ? "text-gold" : "text-coral";
  const cvPct = Math.round(data.cv * 100);

  return (
    <InsightCard title="Income predictability" term="income_predictability">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="num-display text-3xl font-bold text-text-primary">{cvPct}%</span>
        <span className={`text-[11px] font-bold uppercase tracking-wider ${labelColor}`}>{data.label}</span>
      </div>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        Your income varies by {cvPct}% month to month.
      </p>
      <div className="space-y-1.5">
        <Row label="Highest month" value={`${data.highestMonth.month} · ${formatKES(data.highestMonth.amount)}`} accent="text-green" />
        <Row label="Lowest month" value={`${data.lowestMonth.month} · ${formatKES(data.lowestMonth.amount)}`} accent="text-coral" />
        <Row label="Average" value={formatKES(data.mean)} />
      </div>
    </InsightCard>
  );
}

// === 3. Fragility Day ===

export function FragilityDayCard({ data }: { data: FragilityDayInsight }) {
  const { formatKES } = useFormatters();
  return (
    <InsightCard title="Fragility day" term="fragility_day">
      <div className="num-display text-4xl font-bold text-coral mb-1">{ordinal(data.dayOfMonth)}</div>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        Your balance is consistently lowest around the {ordinal(data.dayOfMonth)} of each month.
      </p>
      <div className="space-y-1.5">
        <Row label={`Avg balance on ${ordinal(data.dayOfMonth)}`} value={formatKES(data.averageBalance)} accent="text-coral" />
        <Row label="Peak balance day" value={`${ordinal(data.peakDay)} · ${formatKES(data.peakBalance)}`} accent="text-green" />
      </div>
    </InsightCard>
  );
}

// === 4. Runway ===

export function RunwayCard({ data }: { data: RunwayInsight }) {
  const { formatKES } = useFormatters();
  const color = data.months >= 3 ? "text-green" : data.months >= 1 ? "text-gold" : "text-coral";
  return (
    <InsightCard title="Runway" term="runway">
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className={`num-display text-4xl font-bold ${color}`}>{data.months}</span>
        <span className="text-sm text-text-muted">months</span>
      </div>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        At your current essential spend rate, your balance covers {data.months} months without new income.
      </p>
      <div className="space-y-1.5">
        <Row label="Current balance" value={formatKES(data.currentBalance)} />
        <Row label="Monthly essentials" value={formatKES(data.monthlyEssentials)} />
        {data.essentialCategories.slice(0, 4).map((c) => (
          <Row key={c.name} label={c.name} value={`${formatKES(c.monthly)}/mo`} indent />
        ))}
      </div>
    </InsightCard>
  );
}

// === 5. Lifestyle Creep ===

export function LifestyleCreepCard({ data }: { data: LifestyleCreepInsight }) {
  const { formatKESCompact } = useFormatters();
  return (
    <InsightCard title="Lifestyle creep">
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        Categories where avg spend grew 20%+, while visit frequency stayed flat.
      </p>
      <div className="space-y-3">
        {data.categories.map((c) => (
          <div key={c.category}>
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-[13px] text-text-primary truncate max-w-[60%] font-medium">{c.category}</span>
              <span className="text-sm font-bold text-coral font-mono tabular-nums">+{c.growthPct}%</span>
            </div>
            <p className="text-[10px] text-text-muted font-mono">
              {formatKESCompact(c.earlyAvg)} → {formatKESCompact(c.lateAvg)} per visit
            </p>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}

// === 6. Inflation Exposure ===

export function InflationExposureCard({ data }: { data: InflationExposureInsight }) {
  const { formatKESCompact } = useFormatters();
  return (
    <InsightCard title="Inflation exposure" term="inflation_exposure">
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="num-display text-3xl font-bold text-gold">{data.averageInflation > 0 ? "+" : ""}{data.averageInflation}%</span>
        <span className="text-[11px] text-text-muted">avg bill drift</span>
      </div>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        Price drift on your recurring merchants over the period.
      </p>
      <div className="space-y-2.5">
        {data.merchants.map((m) => (
          <div key={m.name}>
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-[13px] text-text-primary truncate max-w-[55%] font-medium">{m.name}</span>
              <span className={`text-sm font-bold font-mono tabular-nums ${m.changePct > 0 ? "text-coral" : "text-green"}`}>
                {m.changePct > 0 ? "+" : ""}{m.changePct}%
              </span>
            </div>
            <p className="text-[10px] text-text-muted font-mono">
              {formatKESCompact(m.earliestAvg)} → {formatKESCompact(m.latestAvg)}
            </p>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}

// === 7. Leak Total ===

export function LeakTotalCard({ data }: { data: LeakTotalInsight }) {
  const { formatKES, formatKESCompact } = useFormatters();
  return (
    <InsightCard title="Leak total" term="leak_total">
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="num-display text-3xl font-bold text-gradient-coral">{formatKES(data.annualTotal)}</span>
        <span className="text-[11px] text-text-muted">/year</span>
      </div>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        Sub-KES 500 recurring charges that quietly add up.
      </p>
      <div className="space-y-1.5">
        {data.items.map((item, i) => (
          <Row
            key={`${item.name}-${i}`}
            label={item.name}
            value={`${formatKESCompact(item.monthlyCost)}/mo · ${formatKESCompact(item.annualCost)}/yr`}
          />
        ))}
      </div>
    </InsightCard>
  );
}

// === 8. Trajectory ===

export function TrajectoryCard({ data }: { data: TrajectoryInsight }) {
  const { formatKESCompact } = useFormatters();
  const color =
    data.direction === "gaining" ? "text-green" : data.direction === "losing" ? "text-coral" : "text-gold";
  const arrow = data.direction === "gaining" ? "↑" : data.direction === "losing" ? "↓" : "→";

  return (
    <InsightCard title="Income vs spending" term="trajectory">
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`num-display text-3xl font-bold ${color}`}>{arrow} {formatKESCompact(Math.abs(data.netSlope))}</span>
        <span className="text-[11px] text-text-muted">/mo</span>
      </div>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        {data.direction === "gaining"
          ? "You're pulling ahead — income growing faster than spending."
          : data.direction === "losing"
          ? "Spending is outpacing income growth."
          : "Income and spending are growing at similar rates."}
      </p>
      <div className="space-y-1.5">
        <Row
          label="Income trend"
          value={`${data.incomeSlope >= 0 ? "+" : ""}${formatKESCompact(data.incomeSlope)}/mo`}
          accent={data.incomeSlope >= 0 ? "text-green" : "text-coral"}
        />
        <Row
          label="Spending trend"
          value={`${data.spendingSlope >= 0 ? "+" : ""}${formatKESCompact(data.spendingSlope)}/mo`}
          accent={data.spendingSlope >= 0 ? "text-coral" : "text-green"}
        />
      </div>
    </InsightCard>
  );
}

// === 9. Counterparty Direction ===

export function CounterpartyDirectionCard({ data }: { data: CounterpartyDirectionInsight }) {
  const { formatKESCompact } = useFormatters();
  return (
    <InsightCard title="P2P flow direction">
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        Net flow with your top contacts (3+ transactions).
      </p>
      <div className="space-y-2.5">
        {data.contacts.map((c) => (
          <div key={c.phone}>
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-[13px] text-text-primary truncate max-w-[50%] font-medium">{c.name}</span>
              <span className={`text-sm font-bold font-mono tabular-nums ${c.netFlow >= 0 ? "text-green" : "text-coral"}`}>
                {c.netFlow >= 0 ? "+" : ""}{formatKESCompact(c.netFlow)}
              </span>
            </div>
            <p className="text-[10px] text-text-muted font-mono">
              Sent {formatKESCompact(c.sent)} · Received {formatKESCompact(c.received)}
            </p>
          </div>
        ))}
      </div>
    </InsightCard>
  );
}

// === 10. Cash Flow Forecast ===

export function CashFlowForecastCard({ data }: { data: CashFlowForecastInsight }) {
  const { formatKES, formatKESCompact } = useFormatters();
  return (
    <InsightCard title="Cash flow forecast">
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        Projected balance based on recurring obligations and income pattern.
      </p>
      <div className="space-y-3">
        {data.projections.map((p) => {
          const color = p.expectedBalance >= 0 ? "text-green" : "text-coral";
          return (
            <div key={p.days}>
              <div className="flex items-baseline justify-between mb-0.5">
                <span className="text-[13px] text-text-secondary">{p.days} days <span className="text-text-muted">({p.date})</span></span>
                <span className={`text-sm font-bold font-mono tabular-nums ${color}`}>{formatKES(p.expectedBalance)}</span>
              </div>
              <p className="text-[10px] text-text-muted font-mono">
                +{formatKESCompact(p.expectedIncome)} in · -{formatKESCompact(p.expectedOutflows)} out
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between text-xs">
        <span className="text-text-muted">Current balance</span>
        <span className="text-text-secondary font-mono tabular-nums">{formatKES(data.currentBalance)}</span>
      </div>
    </InsightCard>
  );
}

// === Shared row helper ===

function Row({ label, value, accent, indent = false }: { label: string; value: string; accent?: string; indent?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between text-xs ${indent ? "pl-3" : ""}`}>
      <span className="text-text-muted truncate max-w-[55%]">{label}</span>
      <span className={`font-mono tabular-nums ${accent || "text-text-secondary"}`}>{value}</span>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
