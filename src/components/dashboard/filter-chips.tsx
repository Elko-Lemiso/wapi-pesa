"use client";

import { useOverrides } from "@/lib/overrides/context";
import { useToast } from "@/lib/toast/context";

export interface ActiveFilter {
  /** Stable key — used as React key and for dismissal callback. */
  id: string;
  /** Short label shown on the chip ("Last 3 months", "Search: uber"). */
  label: string;
  /** Tone hint — defaults to white/grey neutral. */
  tone?: "coral" | "purple" | "green" | "gold" | "default";
  /** Click X to remove the filter. Optional — chips without a remover are static. */
  onRemove?: () => void;
}

interface FilterChipsProps {
  filters: ActiveFilter[];
  onClearAll?: () => void;
}

const TONE_CLASSES: Record<NonNullable<ActiveFilter["tone"]>, string> = {
  coral: "border-coral/30 bg-coral/10 text-coral-100",
  purple: "border-purple/30 bg-purple/10 text-purple-200",
  green: "border-green/30 bg-green/10 text-green-soft",
  gold: "border-gold/30 bg-gold/10 text-gold-soft",
  default: "border-white/15 bg-white/[0.04] text-text-secondary",
};

/**
 * Renders a horizontal bar of active filter pills. The chip bar collapses to
 * nothing when there are no active filters, so it can be left mounted at the
 * top of any view without taking up space.
 */
export function FilterChips({ filters, onClearAll }: FilterChipsProps) {
  const { count: overrideCount, clearAll: clearOverrides } = useOverrides();
  const { toast } = useToast();
  const allFilters = [...filters];
  if (overrideCount > 0) {
    allFilters.push({
      id: "__overrides__",
      label: `${overrideCount} customised`,
      tone: "purple",
      onRemove: () => {
        clearOverrides();
        toast.info("Customisations cleared", "Your overrides have been reset.");
      },
    });
  }

  const removable = allFilters.filter((f) => f.onRemove);
  if (allFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4 animate-fade-in">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted mr-1">Filters</p>
      {allFilters.map((f) => {
        const tone = f.tone || "default";
        return (
          <span
            key={f.id}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE_CLASSES[tone]}`}
          >
            <span className="truncate max-w-[200px]">{f.label}</span>
            {f.onRemove && (
              <button
                type="button"
                onClick={f.onRemove}
                aria-label={`Remove ${f.label}`}
                className="-mr-1 inline-flex w-4 h-4 items-center justify-center rounded-full hover:bg-white/15 transition-colors"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        );
      })}
      {removable.length > 1 && onClearAll && (
        <button
          type="button"
          onClick={() => {
            for (const f of removable) f.onRemove?.();
            onClearAll();
          }}
          className="ml-1 inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-text-muted hover:text-text-primary hover:border-white/25 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
