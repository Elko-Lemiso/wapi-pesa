"use client";

import { useMemo, useState } from "react";
import { useCurrency, RATE_AS_OF, USD_PER_KES } from "@/lib/currency/context";

export type RangePreset =
  | "all"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_3m"
  | "last_6m"
  | "ytd"
  | "month"
  | "custom";

export interface RangeSelection {
  preset: RangePreset;
  /** ISO start of selected window (inclusive) — null means "from beginning". */
  from: string | null;
  /** ISO end of selected window (inclusive) — null means "to end". */
  to: string | null;
  /** Pretty label for the chip / heading. */
  label: string;
}

interface TimeRangeBarProps {
  /** Full unfiltered statement period — anchor for relative presets. */
  statementPeriod: { from: Date | string; to: Date | string } | null;
  selection: RangeSelection;
  onChange: (next: RangeSelection) => void;
  isLoading?: boolean;
}

export function TimeRangeBar({ statementPeriod, selection, onChange, isLoading }: TimeRangeBarProps) {
  const period = useMemo(() => {
    if (!statementPeriod) return null;
    return {
      from: new Date(statementPeriod.from),
      to: new Date(statementPeriod.to),
    };
  }, [statementPeriod]);

  const months = useMemo(() => buildMonthList(period), [period]);
  const periodLabel = useMemo(() => buildPeriodLabel(period), [period]);
  const { currency, toggle, privacyMode, togglePrivacy } = useCurrency();
  const [customOpen, setCustomOpen] = useState(false);

  const setPreset = (preset: Exclude<RangePreset, "month" | "custom">) => {
    if (!period) return;
    const next = computePresetRange(preset, period);
    onChange(next);
  };

  return (
    <div className="rounded-2xl glass p-4 sm:p-5 mb-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted mb-1">Statement covers</p>
          <p className="text-sm sm:text-base font-medium text-text-primary truncate" title={periodLabel}>
            {periodLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={togglePrivacy}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
              privacyMode
                ? "border-purple/40 bg-purple/15 text-purple-200"
                : "border-white/10 bg-white/[0.03] text-text-secondary hover:text-text-primary hover:border-white/20"
            }`}
            title={privacyMode ? "Reveal amounts" : "Hide amounts (great for screen sharing)"}
            aria-pressed={privacyMode}
          >
            {privacyMode ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            <span className="hidden sm:inline">{privacyMode ? "Hidden" : "Privacy"}</span>
          </button>
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-white/20 transition-colors min-h-[36px]"
            title={`Showing amounts in ${currency}. Tap to switch.`}
          >
            <span className={currency === "KES" ? "text-text-primary" : "text-text-faint"}>KES</span>
            <span className="text-text-faint">·</span>
            <span className={currency === "USD" ? "text-text-primary" : "text-text-faint"}>USD</span>
          </button>
          {currency === "USD" && !privacyMode && (
            <span className="hidden sm:inline text-[10px] text-text-faint">
              KES {Math.round(1 / USD_PER_KES)} / USD · {RATE_AS_OF}
            </span>
          )}
          {isLoading && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
              <span className="w-3 h-3 border border-text-muted/30 border-t-text-muted rounded-full animate-spin" />
              Updating
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <PresetChip active={selection.preset === "all"} onClick={() => setPreset("all")} disabled={!period}>All time</PresetChip>
        <PresetChip active={selection.preset === "ytd"} onClick={() => setPreset("ytd")} disabled={!period}>Year to date</PresetChip>
        <PresetChip active={selection.preset === "last_6m"} onClick={() => setPreset("last_6m")} disabled={!period}>Last 6 months</PresetChip>
        <PresetChip active={selection.preset === "last_3m"} onClick={() => setPreset("last_3m")} disabled={!period}>Last 3 months</PresetChip>
        <PresetChip active={selection.preset === "this_month"} onClick={() => setPreset("this_month")} disabled={!period}>This month</PresetChip>
        <PresetChip active={selection.preset === "last_month"} onClick={() => setPreset("last_month")} disabled={!period}>Last month</PresetChip>
        <PresetChip active={selection.preset === "this_week"} onClick={() => setPreset("this_week")} disabled={!period}>This week</PresetChip>
        <PresetChip active={selection.preset === "last_week"} onClick={() => setPreset("last_week")} disabled={!period}>Last week</PresetChip>

        <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />

        <PresetChip
          active={selection.preset === "custom"}
          onClick={() => setCustomOpen((o) => !o)}
        >
          Custom range
        </PresetChip>
      </div>

      {months.length > 0 && (
        <div className="mt-3 -mx-1 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5 px-1 min-w-min">
            {months.map((m) => (
              <PresetChip
                key={m.key}
                active={selection.preset === "month" && selection.from === m.from.toISOString()}
                onClick={() =>
                  onChange({
                    preset: "month",
                    from: m.from.toISOString(),
                    to: m.to.toISOString(),
                    label: m.label + (m.partial ? " · partial" : ""),
                  })
                }
                tone="month"
              >
                {m.shortLabel}
                {m.partial && <span className="ml-1 text-[9px] text-amber-300/70">·part</span>}
              </PresetChip>
            ))}
          </div>
        </div>
      )}

      {customOpen && period && (
        <CustomRange
          period={period}
          selection={selection}
          onApply={(from, to) => {
            onChange({
              preset: "custom",
              from: from.toISOString(),
              to: to.toISOString(),
              label: `${formatShort(from)} → ${formatShort(to)}`,
            });
            setCustomOpen(false);
          }}
          onClose={() => setCustomOpen(false)}
        />
      )}
    </div>
  );
}

function PresetChip({
  children,
  active,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "month";
}) {
  const base =
    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap min-h-[32px]";
  const cls = active
    ? tone === "month"
      ? "border-purple/40 bg-purple/15 text-purple-200"
      : "border-coral/40 bg-coral/15 text-coral-100"
    : "border-white/10 bg-white/[0.02] text-text-secondary hover:text-text-primary hover:border-white/25 hover:bg-white/[0.05]";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${cls} disabled:opacity-40 disabled:cursor-not-allowed`}>
      {children}
    </button>
  );
}

function CustomRange({
  period,
  selection,
  onApply,
  onClose,
}: {
  period: { from: Date; to: Date };
  selection: RangeSelection;
  onApply: (from: Date, to: Date) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(() => toInputDate(selection.from ? new Date(selection.from) : period.from));
  const [to, setTo] = useState(() => toInputDate(selection.to ? new Date(selection.to) : period.to));
  const minStr = toInputDate(period.from);
  const maxStr = toInputDate(period.to);
  const error =
    new Date(from) > new Date(to)
      ? "Start date must be before end date"
      : new Date(from) < period.from
        ? "Start is before the statement period"
        : new Date(to) > period.to
          ? "End is after the statement period"
          : null;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 flex flex-wrap items-end gap-3">
      <label className="text-xs text-text-muted">
        From
        <input
          type="date"
          value={from}
          min={minStr}
          max={maxStr}
          onChange={(e) => setFrom(e.target.value)}
          className="block mt-1 bg-black/40 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-coral/40"
        />
      </label>
      <label className="text-xs text-text-muted">
        To
        <input
          type="date"
          value={to}
          min={minStr}
          max={maxStr}
          onChange={(e) => setTo(e.target.value)}
          className="block mt-1 bg-black/40 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-coral/40"
        />
      </label>
      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!!error}
          onClick={() => {
            const f = new Date(from + "T00:00:00");
            const t = new Date(to + "T23:59:59");
            onApply(f, t);
          }}
          className="text-xs px-3 py-1.5 rounded-full border border-coral/30 bg-coral/15 text-coral-100 hover:bg-coral/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
      {error && <p className="w-full text-[11px] text-rose">{error}</p>}
    </div>
  );
}

function buildPeriodLabel(period: { from: Date; to: Date } | null): string {
  if (!period) return "Period unknown";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  const days = Math.max(1, Math.round((period.to.getTime() - period.from.getTime()) / 86_400_000) + 1);
  return `${fmt(period.from)} → ${fmt(period.to)} · ${days} days`;
}

interface MonthOption {
  key: string;
  label: string;
  shortLabel: string;
  from: Date;
  to: Date;
  partial: boolean;
}

function buildMonthList(period: { from: Date; to: Date } | null): MonthOption[] {
  if (!period) return [];
  const out: MonthOption[] = [];
  const cursor = new Date(period.from.getFullYear(), period.from.getMonth(), 1);
  const last = new Date(period.to.getFullYear(), period.to.getMonth(), 1);
  while (cursor <= last) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    const clampedStart = monthStart < period.from ? period.from : monthStart;
    const clampedEnd = monthEnd > period.to ? period.to : monthEnd;
    const partial =
      clampedStart.getTime() !== monthStart.getTime() || clampedEnd.getTime() !== monthEnd.getTime();
    out.push({
      key: `${monthStart.getFullYear()}-${monthStart.getMonth()}`,
      label: monthStart.toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
      shortLabel: monthStart.toLocaleDateString("en-KE", { month: "short", year: "2-digit" }),
      from: clampedStart,
      to: clampedEnd,
      partial,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

export function computePresetRange(
  preset: Exclude<RangePreset, "month" | "custom">,
  period: { from: Date; to: Date }
): RangeSelection {
  // We pin "now" to the statement end date so demo data behaves consistently.
  // For most users, period.to is yesterday/today, which lines up with reality.
  const now = period.to;

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
  const startOfWeek = (d: Date) => {
    const x = startOf(d);
    const day = x.getDay() === 0 ? 6 : x.getDay() - 1; // Monday-first
    x.setDate(x.getDate() - day);
    return x;
  };
  const addMonths = (d: Date, n: number) => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
  };
  const clampStart = (d: Date) => (d < period.from ? period.from : d);
  const clampEnd = (d: Date) => (d > period.to ? period.to : d);

  const pretty = (preset: string, from: Date, to: Date): string => {
    const labels: Record<string, string> = {
      all: "All time",
      this_week: "This week",
      last_week: "Last week",
      this_month: "This month",
      last_month: "Last month",
      last_3m: "Last 3 months",
      last_6m: "Last 6 months",
      ytd: "Year to date",
    };
    return labels[preset] ?? `${formatShort(from)} → ${formatShort(to)}`;
  };

  let from: Date;
  let to: Date;

  switch (preset) {
    case "this_week":
      from = clampStart(startOfWeek(now));
      to = endOf(now);
      break;
    case "last_week": {
      const thisStart = startOfWeek(now);
      from = clampStart(addMonths(thisStart, 0));
      from.setDate(thisStart.getDate() - 7);
      to = new Date(thisStart);
      to.setDate(thisStart.getDate() - 1);
      to = endOf(to);
      break;
    }
    case "this_month":
      from = clampStart(startOfMonth(now));
      to = clampEnd(endOf(now));
      break;
    case "last_month": {
      const lm = addMonths(now, -1);
      from = clampStart(startOfMonth(lm));
      to = clampEnd(endOfMonth(lm));
      break;
    }
    case "last_3m":
      from = clampStart(startOfMonth(addMonths(now, -2)));
      to = clampEnd(endOf(now));
      break;
    case "last_6m":
      from = clampStart(startOfMonth(addMonths(now, -5)));
      to = clampEnd(endOf(now));
      break;
    case "ytd":
      from = clampStart(new Date(now.getFullYear(), 0, 1));
      to = clampEnd(endOf(now));
      break;
    case "all":
    default:
      return { preset: "all", from: null, to: null, label: "All time" };
  }

  return {
    preset,
    from: from.toISOString(),
    to: to.toISOString(),
    label: pretty(preset, from, to),
  };
}

function toInputDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export const ALL_TIME_SELECTION: RangeSelection = {
  preset: "all",
  from: null,
  to: null,
  label: "All time",
};
