"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

interface TermTooltipProps {
  term: GlossaryKey;
  /** Optional render override — defaults to the glossary term as label. */
  children?: React.ReactNode;
}

/**
 * Inline ⓘ that exposes a glossary entry on hover or tap. On touch, it toggles
 * open and closes when the user taps outside or presses ESC.
 */
export function TermTooltip({ term, children }: TermTooltipProps) {
  const entry = GLOSSARY[term];
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; placement: "top" | "bottom" } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!triggerRef.current) return;
      if (!triggerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 280;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - tooltipWidth / 2),
      window.innerWidth - tooltipWidth - 8
    );
    const placeAbove = rect.top > 200;
    const top = placeAbove ? rect.top - 12 : rect.bottom + 12;
    setCoords({ left, top, placement: placeAbove ? "top" : "bottom" });
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label={`What is ${entry.label}?`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          // Touch users — toggle
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className="inline-flex items-center gap-0.5 text-text-faint hover:text-text-secondary focus:text-text-secondary outline-none transition-colors"
      >
        {children ?? <span className="text-[10px] uppercase tracking-wider">{entry.label}</span>}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 8h.01M11 12h1v4h1" />
        </svg>
      </button>

      {open && coords && (
        <div
          role="tooltip"
          id={id}
          style={{
            position: "fixed",
            left: coords.left,
            top: coords.placement === "top" ? coords.top : coords.top,
            transform: coords.placement === "top" ? "translateY(-100%)" : undefined,
            width: 280,
            zIndex: 60,
          }}
          className="pointer-events-none animate-fade-in"
        >
          <div className="rounded-xl bg-[#0a1224] ring-1 ring-white/15 shadow-xl shadow-black/40 px-3.5 py-3 text-[12px] text-text-secondary leading-relaxed">
            <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted mb-1">{entry.label}</p>
            {entry.body}
          </div>
        </div>
      )}
    </>
  );
}
