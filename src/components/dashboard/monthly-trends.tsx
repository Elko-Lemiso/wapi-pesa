"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { MonthlyTrend } from "@/lib/parser/types";
import { useCurrency } from "@/lib/currency/context";

interface MonthlyTrendsProps {
  data: MonthlyTrend[];
}

export function MonthlyTrends({ data }: MonthlyTrendsProps) {
  const { convert, symbol } = useCurrency();
  const axisTick = (v: number) => {
    const x = convert(v);
    const abs = Math.abs(x);
    if (abs >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(x / 1_000).toFixed(0)}K`;
    return Math.round(x).toString();
  };
  const chartData = data.map((item) => ({
    month: item.month,
    Inflows: convert(item.inflows),
    Outflows: convert(item.outflows),
  }));

  return (
    <section className="rounded-3xl glass p-6 lg:p-7 h-full flex flex-col">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5">Trend</p>
          <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Monthly flow</h3>
        </div>
        <div className="flex items-center gap-3">
          <Legend dot="bg-green" label="In" />
          <Legend dot="bg-coral" label="Out" />
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-56 flex-1 flex items-center justify-center text-center px-6">
          <div>
            <p className="text-sm text-text-muted">Not enough months in this range to plot a trend.</p>
            <p className="text-[11px] text-text-faint mt-1.5">Try widening the time window.</p>
          </div>
        </div>
      ) : (
      <div className="h-56 flex-1 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradInflows" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d68f" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#00d68f" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOutflows" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff6a4a" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#ff6a4a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="month" stroke="#5d6c84" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#5d6c84" fontSize={10} tickFormatter={axisTick} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(10, 18, 36, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                fontSize: 11,
                backdropFilter: "blur(12px)",
                boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
              }}
              formatter={(value, name) => [`${symbol} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, String(name)]}
              labelStyle={{ color: "#f4f6fb", fontSize: 11, fontWeight: 600 }}
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            />
            <Area type="monotone" dataKey="Inflows" stroke="#00d68f" fill="url(#gradInflows)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#00d68f" }} />
            <Area type="monotone" dataKey="Outflows" stroke="#ff6a4a" fill="url(#gradOutflows)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#ff6a4a" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}
    </section>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
    </div>
  );
}
