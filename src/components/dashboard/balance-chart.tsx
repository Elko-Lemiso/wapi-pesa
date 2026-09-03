"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { BalancePoint } from "@/lib/parser/types";
import { useCurrency, useFormatMoney } from "@/lib/currency/context";

interface BalanceChartProps {
  data: BalancePoint[];
}

export function BalanceChart({ data }: BalanceChartProps) {
  const formatMoney = useFormatMoney();
  const { convert, symbol } = useCurrency();
  // Compact label suitable for axis ticks: "12K" without the currency code prefix.
  const axisTick = (v: number) => {
    const x = convert(v);
    const abs = Math.abs(x);
    if (abs >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(x / 1_000).toFixed(0)}K`;
    return Math.round(x).toString();
  };
  if (data.length === 0) return null;

  const step = Math.max(1, Math.floor(data.length / 90));
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  const balances = sampled.map((d) => d.balance);
  const maxBalance = Math.max(...balances);
  const minBalance = Math.min(...balances);
  const lastBalance = balances[balances.length - 1];

  return (
    <section className="rounded-3xl glass p-6 lg:p-7 h-full flex flex-col">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5">Balance</p>
          <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Daily trajectory</h3>
        </div>
        <div className="flex items-center gap-4 text-right">
          <Stat label="Peak" value={formatMoney(maxBalance, { compact: true })} accent="text-green" />
          <Stat label="Low" value={formatMoney(minBalance, { compact: true })} accent="text-coral" />
          <Stat label="End" value={formatMoney(lastBalance, { compact: true })} accent="text-text-primary" />
        </div>
      </div>
      <div className="h-56 flex-1 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampled} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d68f" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#00d68f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#5d6c84"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(sampled.length / 5)}
            />
            <YAxis stroke="#5d6c84" fontSize={10} tickFormatter={axisTick} tickLine={false} axisLine={false} width={45} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(10, 18, 36, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                fontSize: 11,
                backdropFilter: "blur(12px)",
                boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
              }}
              formatter={(value) => [`${symbol} ${convert(Number(value)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "Balance"]}
              labelStyle={{ color: "#f4f6fb", fontSize: 11, fontWeight: 600 }}
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            />
            <Area type="monotone" dataKey="balance" stroke="#00d68f" fill="url(#balGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#00d68f" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`text-xs font-semibold font-mono tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}
