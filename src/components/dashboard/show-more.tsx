"use client";

import { useState } from "react";

interface ShowMoreProps {
  /** How many items to show by default. */
  initial: number;
  /** Total list length — needed to render "Show more (N)" with the count. */
  total: number;
  /** Whether the list is currently expanded; controlled by the parent. */
  expanded: boolean;
  onToggle: (next: boolean) => void;
  /** Optional eyebrow to show alongside (e.g., "of 23"). */
  hint?: string;
}

/**
 * Tiny "Show more / Show less" toggle button. Only renders when there's
 * actually more to show.
 */
export function ShowMoreToggle({ initial, total, expanded, onToggle, hint }: ShowMoreProps) {
  if (total <= initial) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      {hint && <p className="text-[10px] text-text-faint truncate flex-1">{hint}</p>}
      <button
        type="button"
        onClick={() => onToggle(!expanded)}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] text-text-secondary hover:text-text-primary hover:border-white/25 transition-colors min-h-[28px] flex-shrink-0"
      >
        {expanded ? (
          <>
            Show less
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </>
        ) : (
          <>
            Show more · {total - initial}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Stateful wrapper. Use when the parent doesn't need to track the expand
 * state for any other reason.
 */
export function useShowMore(): [boolean, (v: boolean) => void] {
  const [expanded, setExpanded] = useState(false);
  return [expanded, setExpanded];
}
