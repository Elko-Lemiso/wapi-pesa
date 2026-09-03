"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatMoney } from "@/lib/currency/context";
import type { TransactionRowData } from "./transaction-row";

interface SearchBarProps {
  sessionId: string;
  rangeFrom: string | null;
  rangeTo: string | null;
  /** Open the drill panel showing all matching transactions. */
  onShowAll: (query: string) => void;
  /** Optional URL-state hydration. */
  initialQuery?: string;
  /** Notified on every query mutation (debounced or not — fires on raw input). */
  onQueryChange?: (q: string) => void;
}

interface ApiResult {
  transactions: TransactionRowData[];
  total: number;
  aggregates?: { totalIn: number; totalOut: number; count: number };
}

/** Narrow an arbitrary JSON body to an `ApiResult` we can safely render from. */
function parseApiResult(body: unknown): ApiResult | null {
  if (!body || typeof body !== "object") return null;
  const r = body as Partial<ApiResult>;
  if (!Array.isArray(r.transactions)) return null;
  if (typeof r.total !== "number" || Number.isNaN(r.total)) return null;
  return r as ApiResult;
}

const DEBOUNCE_MS = 200;

export function SearchBar({ sessionId, rangeFrom, rangeTo, onShowAll, initialQuery = "", onQueryChange }: SearchBarProps) {
  const formatMoney = useFormatMoney();
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Debounce: 200ms. We track first-paint with `interactedRef` so we don't
  // fire `onQueryChange` for the initial hydration value — that would
  // pointlessly churn URL state on mount.
  const interactedRef = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = query.trim();
      setDebouncedQuery(trimmed);
      if (interactedRef.current) {
        onQueryChange?.(trimmed);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query, onQueryChange]);

  // Fetch matches
  useEffect(() => {
    if (!debouncedQuery) {
      /* eslint-disable react-hooks/set-state-in-effect -- Clearing a completed
       * request is the synchronization this query-driven effect performs. */
      setData(null);
      setError(null);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("sessionId", sessionId);
    params.set("search", debouncedQuery);
    params.set("limit", "5");
    params.set("includeAggregates", "true");
    if (rangeFrom) params.set("from", rangeFrom);
    if (rangeTo) params.set("to", rangeTo);
    fetch(`/api/transactions?${params.toString()}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (cancelled) return;
        if (!r.ok) {
          // Most common case: the parsed statement was cleared (e.g. after
          // PDF generation) or the session expired. Render a friendly
          // explanation instead of crashing.
          const msg =
            (body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : null) ?? `Search unavailable (${r.status})`;
          setError(msg);
          setData(null);
          setLoading(false);
          return;
        }
        const parsed = parseApiResult(body);
        if (!parsed) {
          setError("Search unavailable");
          setData(null);
        } else {
          setData(parsed);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't reach the server");
        setData(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, sessionId, rangeFrom, rangeTo]);

  // ESC clears, blur closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
          if (e.key === "Escape") {
        if (document.activeElement === inputRef.current || open) {
          e.preventDefault();
          if (query) {
            interactedRef.current = true;
            setQuery("");
          } else {
            setOpen(false);
            inputRef.current?.blur();
          }
        }
      }
      // ⌘/Ctrl-K or `/` to focus
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && document.activeElement?.tagName !== "INPUT";
      if (isCmdK || isSlash) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, open]);

  // Close popover when clicking outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const showPopover = open && debouncedQuery.length > 0;

  return (
    <div className="sticky top-0 z-30 -mx-1 px-1 py-2 backdrop-blur-md bg-ink/70" ref={wrapRef}>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.65 5.65a7.5 7.5 0 0011 11z" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            interactedRef.current = true;
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search merchant, contact, paybill, amount, receipt…"
          aria-label="Search transactions"
          className="w-full pl-10 pr-24 py-3 rounded-2xl glass border border-white/10 focus:border-coral/40 focus:ring-2 focus:ring-coral/20 outline-none text-sm text-text-primary placeholder:text-text-faint transition-all min-h-[48px]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          {query && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                interactedRef.current = true;
                setQuery("");
              }}
              className="pointer-events-auto inline-flex w-6 h-6 rounded-full bg-white/[0.05] ring-1 ring-white/10 hover:ring-white/20 items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-text-faint">
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] ring-1 ring-white/10 font-mono text-[10px]">/</kbd>
            <span>to focus</span>
          </span>
        </span>
      </div>

      {showPopover && (
        <div className="absolute left-1 right-1 mt-2 rounded-2xl glass border border-white/10 shadow-xl shadow-black/40 overflow-hidden z-40">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="text-[11px] text-text-muted">
              {loading ? (
                "Searching…"
              ) : error ? (
                <span className="text-rose">{error}</span>
              ) : data ? (
                data.total === 0 ? (
                  <span>No transactions match &ldquo;{debouncedQuery}&rdquo;.</span>
                ) : (
                  <span>
                    <span className="text-text-secondary tabular-nums">{data.total.toLocaleString()}</span> match
                    {data.total === 1 ? "" : "es"} for &ldquo;{debouncedQuery}&rdquo;
                  </span>
                )
              ) : null}
            </p>
            {data?.aggregates && (data.aggregates.totalIn > 0 || data.aggregates.totalOut > 0) && (
              <p className="text-[11px] tabular-nums">
                {data.aggregates.totalIn > 0 && (
                  <span className="text-green">+{formatMoney(data.aggregates.totalIn, { compact: true })}</span>
                )}
                {data.aggregates.totalIn > 0 && data.aggregates.totalOut > 0 && (
                  <span className="text-text-faint mx-1">·</span>
                )}
                {data.aggregates.totalOut > 0 && (
                  <span className="text-coral">-{formatMoney(data.aggregates.totalOut, { compact: true })}</span>
                )}
              </p>
            )}
          </div>
          {data && data.transactions.length > 0 && (
            <ul className="divide-y divide-white/[0.04] max-h-72 overflow-y-auto">
              {data.transactions.map((t) => (
                <li key={t.receiptNo} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-text-primary truncate">
                        {t.counterparty.name || t.counterparty.maskedPhone || t.counterparty.paybill || "—"}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">
                        {new Date(t.completionTime).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                        })}
                        {" · "}
                        {t.details.replace(/\s+/g, " ").slice(0, 80)}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold font-mono tabular-nums ${
                        t.direction === "in" ? "text-green" : "text-coral"
                      }`}
                    >
                      {t.direction === "in" ? "+" : "-"}
                      {formatMoney(t.amount, { compact: true })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {data && data.total > data.transactions.length && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onShowAll(debouncedQuery);
              }}
              className="block w-full text-center px-4 py-3 text-xs font-medium text-coral border-t border-white/5 hover:bg-coral/[0.05] transition-colors min-h-[44px]"
            >
              Show all {data.total.toLocaleString()} matches →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
