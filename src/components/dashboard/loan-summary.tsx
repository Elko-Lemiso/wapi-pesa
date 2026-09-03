"use client";

import type { MobileLoanSummary as MobileLoanSummaryType } from "@/lib/parser/types";
import { useFormatMoney } from "@/lib/currency/context";
import { TermTooltip } from "./term-tooltip";

interface LoanSummaryProps {
  data: MobileLoanSummaryType;
}

export function LoanSummary({ data }: LoanSummaryProps) {
  const formatKES = useFormatMoney();
  if (data.lenders.length === 0 && data.totalBorrowed === 0) return null;

  return (
    <section className="rounded-3xl glass p-6 lg:p-7">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <p className="eyebrow mb-1.5 inline-flex items-center gap-1.5">
            Borrowing
            <TermTooltip term="od_loan">
              <span className="sr-only">What is an OD Loan?</span>
            </TermTooltip>
          </p>
          <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Mobile loans</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        <KpiCell label="Borrowed" value={formatKES(data.totalBorrowed)} accent="text-gold" />
        <KpiCell label="Repaid" value={formatKES(data.totalRepaid)} accent="text-green" />
        <KpiCell label="Fees" value={formatKES(data.totalFees)} accent="text-coral" />
        <KpiCell
          label="APR effective"
          value={data.effectiveAnnualRate ? `${data.effectiveAnnualRate.toFixed(0)}%` : "—"}
          accent="text-purple"
        />
      </div>

      {data.lenders.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-2">Lenders</p>
          {data.lenders.map((lender, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-white/[0.025] ring-1 ring-white/5 hover:ring-white/15 transition-all">
              <div className="min-w-0">
                <p className="text-sm text-text-primary font-medium truncate">{lender.name}</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {lender.transactions}× · Fees {formatKES(lender.fees)}
                </p>
              </div>
              <span className="text-sm font-semibold text-gold flex-shrink-0 ml-3 font-mono tabular-nums">
                {formatKES(lender.borrowed)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function KpiCell({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-white/[0.025] ring-1 ring-white/5 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-1">{label}</p>
      <p className={`num-display text-base font-bold ${accent}`}>{value}</p>
    </div>
  );
}
