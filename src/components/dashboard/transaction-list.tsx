"use client";

import { useEffect, useMemo, useState } from "react";
import { TransactionRow, type TransactionRowData } from "./transaction-row";
import { useFormatMoney } from "@/lib/currency/context";

export type SortKey = "date" | "amount" | "name";
export type SortDir = "asc" | "desc";

interface TransactionListProps {
  sessionId: string;
  filter: TransactionFilter;
  /** Page size (default 50). */
  pageSize?: number;
  /** Show running totals header. */
  showTotals?: boolean;
}

export interface TransactionFilter {
  from?: string | null;
  to?: string | null;
  search?: string | null;
  category?: string | null;
  direction?: "in" | "out" | null;
  contactKey?: string | null;
  paybill?: string | null;
  till?: string | null;
  merchant?: string | null;
}

interface ApiResult {
  transactions: TransactionRowData[];
  total: number;
  aggregates?: { totalIn: number; totalOut: number; count: number };
}

export function TransactionList({ sessionId, filter, pageSize = 50, showTotals = true }: TransactionListProps) {
  const formatMoney = useFormatMoney();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "desc" });

  const filterKey = useMemo(() => JSON.stringify(filter), [filter]);

  // Reset to page 0 on filter change
  useEffect(() => {
    // The active page is local UI state synchronized to the external filter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
  }, [filterKey]);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- Mark this paginated
     * request as pending before its asynchronous result can settle. */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const params = new URLSearchParams();
    params.set("sessionId", sessionId);
    params.set("limit", String(pageSize));
    params.set("offset", String(page * pageSize));
    if (showTotals) params.set("includeAggregates", "true");
    if (filter.from) params.set("from", filter.from);
    if (filter.to) params.set("to", filter.to);
    if (filter.search) params.set("search", filter.search);
    if (filter.category) params.set("category", filter.category);
    if (filter.direction) params.set("direction", filter.direction);
    if (filter.contactKey) params.set("contactKey", filter.contactKey);
    if (filter.paybill) params.set("paybill", filter.paybill);
    if (filter.till) params.set("till", filter.till);
    if (filter.merchant) params.set("merchant", filter.merchant);

    fetch(`/api/transactions?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((d: ApiResult) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, page, pageSize, filterKey, showTotals, filter]);

  const sortedRows = useMemo(() => {
    if (!data) return [];
    // Client-side sort within the current page. Server already returns by date desc.
    const cmp = (a: TransactionRowData, b: TransactionRowData) => {
      let v = 0;
      if (sort.key === "date") {
        v = new Date(a.completionTime).getTime() - new Date(b.completionTime).getTime();
      } else if (sort.key === "amount") {
        v = a.amount - b.amount;
      } else if (sort.key === "name") {
        const an = (a.counterparty.name || "").toLowerCase();
        const bn = (b.counterparty.name || "").toLowerCase();
        v = an.localeCompare(bn);
      }
      return sort.dir === "asc" ? v : -v;
    };
    return [...data.transactions].sort(cmp);
  }, [data, sort]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const showFrom = total > 0 ? page * pageSize + 1 : 0;
  const showTo = Math.min(total, (page + 1) * pageSize);

  const cycleSort = (key: SortKey) => {
    setSort((s) => {
      if (s.key !== key) return { key, dir: key === "name" ? "asc" : "desc" };
      return { key, dir: s.dir === "asc" ? "desc" : "asc" };
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {showTotals && (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/5 bg-white/[0.015] sticky top-0 z-10 backdrop-blur-sm flex-shrink-0">
          <div className="text-[11px] text-text-muted">
            {loading ? (
              "Loading…"
            ) : error ? (
              <span className="text-rose">{error}</span>
            ) : total === 0 ? (
              <span>No transactions match.</span>
            ) : (
              <span>
                Showing <span className="text-text-secondary tabular-nums">{showFrom}–{showTo}</span> of{" "}
                <span className="text-text-secondary tabular-nums">{total.toLocaleString()}</span>
              </span>
            )}
          </div>
          {data?.aggregates && (
            <div className="flex items-center gap-3 text-[11px] tabular-nums">
              {data.aggregates.totalIn > 0 && (
                <span className="text-green">+{formatMoney(data.aggregates.totalIn, { compact: true })}</span>
              )}
              {data.aggregates.totalOut > 0 && (
                <span className="text-coral">-{formatMoney(data.aggregates.totalOut, { compact: true })}</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 text-[10px] uppercase tracking-wider text-text-muted flex-shrink-0">
        <SortBtn label="Date" active={sort.key === "date"} dir={sort.dir} onClick={() => cycleSort("date")} />
        <SortBtn label="Recipient" active={sort.key === "name"} dir={sort.dir} onClick={() => cycleSort("name")} />
        <span className="ml-auto" />
        <SortBtn label="Amount" active={sort.key === "amount"} dir={sort.dir} onClick={() => cycleSort("amount")} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 py-1.5 divide-y divide-white/[0.03]">
        {loading && !data ? (
          <SkeletonRows count={Math.min(pageSize, 6)} />
        ) : sortedRows.length === 0 ? (
          <EmptyState />
        ) : (
          sortedRows.map((tx) => <TransactionRow key={tx.receiptNo} tx={tx} />)
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-white/5 flex-shrink-0">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1.5 text-xs rounded-full border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
          >
            ← Prev
          </button>
          <span className="text-[11px] text-text-muted tabular-nums">
            Page {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-xs rounded-full border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function SortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors min-h-[28px] ${
        active ? "text-text-primary bg-white/[0.04]" : "text-text-muted hover:text-text-secondary hover:bg-white/[0.02]"
      }`}
    >
      {label}
      <span className={`text-[9px] ${active ? "opacity-100" : "opacity-30"}`}>
        {active ? (dir === "asc" ? "▲" : "▼") : "▾"}
      </span>
    </button>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-1.5 px-1.5 py-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="w-10 h-10 rounded-md bg-white/5" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 rounded bg-white/5" />
            <div className="h-2.5 w-1/2 rounded bg-white/5" />
          </div>
          <div className="h-3 w-16 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-text-muted">Nothing matches that filter.</p>
      <p className="text-[11px] text-text-faint mt-1">Try clearing the search or picking a different range.</p>
    </div>
  );
}
