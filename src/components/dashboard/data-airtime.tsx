"use client";

import type { DataAirtimeSummary } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";

interface DataAirtimeProps {
  data: DataAirtimeSummary;
}

export function DataAirtime({ data }: DataAirtimeProps) {
  const formatKES = useFormatMoney();
  const total = data.totalDataSpend + data.totalAirtimeSpend;
  if (total === 0) return null;

  const dataPerc = total > 0 ? (data.totalDataSpend / total) * 100 : 0;

  return (
    <section className="rounded-3xl glass p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5">Connectivity</p>
          <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">Data & airtime</h3>
        </div>
        <div className="text-right">
          <p className="num-display text-xl font-bold text-blue-400">{formatKES(total)}</p>
          <p className="text-[10px] text-text-muted">~{formatKES(data.monthlyAverage)}/mo</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="h-2 rounded-full overflow-hidden flex bg-white/5">
          <div className="bg-gradient-to-r from-blue-400 to-cyan-400 h-full" style={{ width: `${dataPerc}%` }} />
          <div className="bg-gradient-to-r from-gold to-amber-400 h-full" style={{ width: `${100 - dataPerc}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-[10px]">
          <span className="text-blue-400 font-medium">Data {dataPerc.toFixed(0)}%</span>
          <span className="text-gold font-medium">Airtime {(100 - dataPerc).toFixed(0)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <Mini label="Data bundles" value={formatKES(data.totalDataSpend)} sub={`${data.dataPurchaseCount} purchases`} accent="text-blue-400" />
        <Mini label="Airtime" value={formatKES(data.totalAirtimeSpend)} sub={`${data.airtimePurchaseCount} purchases`} accent="text-gold" />
      </div>
    </section>
  );
}

function Mini({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-xl bg-white/[0.025] ring-1 ring-white/5 p-3">
      <p className="text-[9px] uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className={`text-sm font-bold mt-1 ${accent} font-mono tabular-nums`}>{value}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>
    </div>
  );
}
