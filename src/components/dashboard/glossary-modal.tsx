"use client";

import { useEffect, useRef } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

interface GlossaryModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Help → glossary modal. Renders every entry in `lib/glossary.ts` grouped by
 * topic. Shares the same data the inline ⓘ tooltips use, so wording can never
 * drift between the two.
 */
const TOPIC_GROUPS: { title: string; entries: GlossaryKey[] }[] = [
  {
    title: "M-Pesa terms",
    entries: ["fuliza", "globalpay", "imts", "paybill", "till", "od_loan"],
  },
  {
    title: "Insights & metrics",
    entries: [
      "real_disposable_income",
      "fragility_day",
      "runway",
      "leak_total",
      "inflation_exposure",
      "income_predictability",
      "trajectory",
    ],
  },
  {
    title: "Methodology",
    entries: ["cv", "reconciliation", "partial_month"],
  },
];

export function GlossaryModal({ open, onClose }: GlossaryModalProps) {
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Glossary"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 animate-fade-in"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
      />
      <div className="relative w-full max-w-xl max-h-full flex flex-col rounded-3xl glass-strong shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between gap-3 p-6 border-b border-white/5 flex-shrink-0">
          <div>
            <p className="eyebrow mb-1.5">Help</p>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight">
              Glossary
            </h2>
            <p className="text-xs text-text-muted mt-1.5">
              Plain-English definitions for the terms used in your report.
            </p>
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

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {TOPIC_GROUPS.map((group) => (
            <section key={group.title}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
                {group.title}
              </p>
              <dl className="space-y-3">
                {group.entries.map((key) => {
                  const e = GLOSSARY[key];
                  return (
                    <div
                      key={key}
                      className="rounded-xl bg-white/[0.025] ring-1 ring-white/5 p-3.5"
                    >
                      <dt className="text-sm font-semibold text-text-primary mb-1">{e.label}</dt>
                      <dd className="text-[13px] leading-relaxed text-text-secondary">
                        {e.body}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </div>

        <footer className="px-6 py-3 border-t border-white/5 flex items-center justify-between text-[11px] text-text-muted flex-shrink-0">
          <span>Press ESC to close</span>
          <span>Wapi Pesa · v1</span>
        </footer>
      </div>
    </div>
  );
}
