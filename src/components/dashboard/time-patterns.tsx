"use client";

import type { TimePatterns as TimePatternsType } from "@/lib/parser/types";

interface TimePatternsProps {
  data: TimePatternsType;
}

export function TimePatterns({ data }: TimePatternsProps) {
  const max = Math.max(...data.hourlyDistribution, 1);
  const total = data.weekdayVsWeekend.weekday + data.weekdayVsWeekend.weekend;
  const weekdayPct = total > 0 ? Math.round((data.weekdayVsWeekend.weekday / total) * 100) : 0;

  return (
    <section className="rounded-3xl glass p-6 lg:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5">Rhythm</p>
          <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">When you transact</h3>
        </div>
        <p className="text-text-muted text-[11px]">By hour</p>
      </div>

      <div className="flex items-end gap-[3px] h-32 mb-2">
        {data.hourlyDistribution.map((count, hour) => {
          const height = max > 0 ? (count / max) * 100 : 0;
          const isLateNight = hour >= 22 || hour < 4;
          const isPeak = count === max && count > 0;
          return (
            <div
              key={hour}
              className="flex-1 rounded-t transition-all hover:brightness-150 cursor-pointer relative group"
              style={{
                height: `${Math.max(height, 3)}%`,
                background: isLateNight
                  ? `linear-gradient(180deg, #c4b5fd, #8b5cf6)`
                  : `linear-gradient(180deg, #5ff0bd, #00d68f)`,
                opacity: height > 0 ? 0.35 + (height / 100) * 0.65 : 0.12,
                boxShadow: isPeak ? `0 0 14px ${isLateNight ? "rgba(139,92,246,0.5)" : "rgba(0,214,143,0.5)"}` : "none",
              }}
              title={`${hour.toString().padStart(2, "0")}:00 — ${count} txns`}
            >
              <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {String(hour).padStart(2, "0")}:00 · {count}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-text-muted px-0.5 mb-6 font-mono">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SubStat value={`${weekdayPct}%`} label="Weekdays" accent="text-green" />
        <SubStat value={`${100 - weekdayPct}%`} label="Weekends" accent="text-coral" />
        <SubStat value={`${data.lateNightTransactions.count}`} label="Late night" accent="text-purple" />
      </div>
    </section>
  );
}

function SubStat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="rounded-xl bg-white/[0.025] ring-1 ring-white/5 p-3 text-center">
      <p className={`num-display text-xl font-bold ${accent}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-text-muted mt-1">{label}</p>
    </div>
  );
}
