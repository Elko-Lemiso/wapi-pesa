"use client";

import type { FeesBreakdown as FeesBreakdownType } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";

interface FeesBreakdownProps {
  data: FeesBreakdownType;
}

export function FeesBreakdown({ data }: FeesBreakdownProps) {
  const formatKES = useFormatMoney();
  if (data.totalFees === 0) return null;

  const items = [
    { label: "Send", amount: data.sendMoneyFees, color: "#ff6a4a" },
    { label: "Paybill", amount: data.paybillFees, color: "#f5b731" },
    { label: "Merchant", amount: data.merchantFees, color: "#00d68f" },
    { label: "Withdraw", amount: data.withdrawalFees, color: "#8b5cf6" },
    { label: "Other", amount: data.otherFees, color: "#3b82f6" },
  ].filter((i) => i.amount > 0);

  return (
    <section className="rounded-3xl glass p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5 text-coral-soft">Fees</p>
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">Charges paid</h3>
        </div>
        <div className="text-right">
          <p className="num-display text-xl font-bold text-coral">{formatKES(data.totalFees)}</p>
          <p className="text-[10px] text-text-muted">{data.feesAsPercentage.toFixed(1)}% of spend</p>
        </div>
      </div>

      <div className="h-2 rounded-full overflow-hidden flex mb-4 bg-white/5">
        {items.map((item) => (
          <div
            key={item.label}
            className="h-full"
            style={{ width: `${(item.amount / data.totalFees) * 100}%`, backgroundColor: item.color }}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 py-1">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-text-secondary flex-1">{item.label}</span>
            <span className="text-xs text-text-muted font-mono tabular-nums">{formatKES(item.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
