"use client";

import { useEffect, useRef } from "react";
import { TransactionList, type TransactionFilter } from "./transaction-list";

export interface DrillTarget {
  /** Heading shown at the top of the panel. */
  title: string;
  /** Smaller subtitle (paybill number, masked phone, count, etc.). */
  subtitle?: string;
  /** Filter passed straight to the transactions API. */
  filter: TransactionFilter;
  /** Optional eyebrow tag to colour-code the panel. */
  tone?: "coral" | "green" | "purple" | "gold" | "default";
}

interface DrillPanelProps {
  sessionId: string;
  open: boolean;
  target: DrillTarget | null;
  onClose: () => void;
  /** Forwarded to the panel header. */
  rangeLabel?: string;
}

export function DrillPanel({ sessionId, open, target, onClose, rangeLabel }: DrillPanelProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    // Prevent body scroll while the panel is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !target) return null;

  const toneAccent = {
    coral: "border-coral/30",
    green: "border-green/30",
    purple: "border-purple/30",
    gold: "border-gold/30",
    default: "border-white/10",
  }[target.tone || "default"];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={target.title}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />
      <aside
        className={`relative w-full sm:max-w-xl bg-[#0a1224] border-l ${toneAccent} flex flex-col shadow-[0_0_60px_-10px_rgba(0,0,0,0.6)] sm:rounded-l-3xl
          h-full max-h-screen sm:m-0 m-0
          animate-slide-up sm:animate-slide-in-right
        `}
      >
        <header className="flex items-start gap-3 p-5 border-b border-white/5 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted mb-1">Drill-down</p>
            <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight text-text-primary truncate">
              {target.title}
            </h3>
            {target.subtitle && (
              <p className="text-xs text-text-muted truncate mt-0.5">{target.subtitle}</p>
            )}
            {rangeLabel && (
              <p className="text-[10px] text-text-faint mt-0.5">In current range: {rangeLabel}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/20 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 min-h-0">
          <TransactionList sessionId={sessionId} filter={target.filter} pageSize={50} />
        </div>
      </aside>
    </div>
  );
}
