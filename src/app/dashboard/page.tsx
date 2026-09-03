"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AnalyticsResult } from "@/lib/parser/types";
import { CurrencyProvider, type Currency } from "@/lib/currency/context";
import { OverrideProvider } from "@/lib/overrides/context";
import { useUrlState } from "@/lib/url-state";
import {
  TimeRangeBar,
  ALL_TIME_SELECTION,
  computePresetRange,
  type RangePreset,
  type RangeSelection,
} from "@/components/dashboard/time-range-bar";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { MonthlyTrends } from "@/components/dashboard/monthly-trends";
import { TopRecipients } from "@/components/dashboard/top-recipients";
import { TimePatterns } from "@/components/dashboard/time-patterns";
import { RecurringPayments } from "@/components/dashboard/recurring-payments";
import { LoanSummary } from "@/components/dashboard/loan-summary";
import { StreaksExtremes } from "@/components/dashboard/streaks-extremes";
import { ExportBar } from "@/components/dashboard/export-bar";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { FeesBreakdown } from "@/components/dashboard/fees-breakdown";
import { InternationalTransfers } from "@/components/dashboard/international-transfers";
import { GlobalPayMerchants } from "@/components/dashboard/globalpay-merchants";
import { DataAirtime } from "@/components/dashboard/data-airtime";
import { IncomeStreams } from "@/components/dashboard/income-streams";
import { Promotions } from "@/components/dashboard/promotions";
import {
  DisposableIncomeCard,
  IncomePredictabilityCard,
  FragilityDayCard,
  RunwayCard,
  LifestyleCreepCard,
  InflationExposureCard,
  LeakTotalCard,
  TrajectoryCard,
  CounterpartyDirectionCard,
  CashFlowForecastCard,
} from "@/components/dashboard/deep-insights";
import { SearchBar } from "@/components/dashboard/search-bar";
import { DrillProvider, useDrill } from "@/components/dashboard/drill-context";
import { DrillPanel } from "@/components/dashboard/drill-panel";
import { FilterChips, type ActiveFilter } from "@/components/dashboard/filter-chips";
import { SectionNav, type NavSection } from "@/components/dashboard/section-nav";
import { GlossaryModal } from "@/components/dashboard/glossary-modal";
import { ToastProvider, useToast } from "@/lib/toast/context";

function hasDeepInsights(a: AnalyticsResult): boolean {
  return !!(
    a.disposableIncome || a.incomePredictability || a.fragilityDay ||
    a.runwayMonths || a.lifestyleCreep || a.inflationExposure ||
    a.leakTotal || a.trajectory || a.counterpartyDirection || a.cashFlowForecast
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <div className="animate-spin-slow w-8 h-8 border-2 border-coral/20 border-t-coral rounded-full" />
        </div>
      }
    >
      <DashboardShell />
    </Suspense>
  );
}

/**
 * Wraps the content with currency + override providers and binds them to the
 * URL so a refresh keeps state. We keep the heavy `DashboardContent` separate
 * so providers can read the URL via Suspense before mounting.
 */
function DashboardShell() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const { patch } = useUrlState();

  const initialCurrency: Currency = searchParams.get("c") === "USD" ? "USD" : "KES";
  const initialPrivacy = searchParams.get("private") === "1";

  return (
    <ToastProvider>
      <CurrencyProvider
        initialCurrency={initialCurrency}
        initialPrivacyMode={initialPrivacy}
        onCurrencyChange={(c) => patch({ c: c === "USD" ? "USD" : null })}
        onPrivacyChange={(v) => patch({ private: v ? "1" : null })}
      >
        <OverrideProvider scopeId={sessionId}>
          <DrillProvider>
            <DashboardContent />
          </DrillProvider>
        </OverrideProvider>
      </CurrencyProvider>
    </ToastProvider>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const drill = useDrill();
  const { state: urlState, patch: patchUrl } = useUrlState();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [previousAnalytics, setPreviousAnalytics] = useState<AnalyticsResult | null>(null);
  /**
   * The full statement period from the first analytics fetch. We hold this
   * separately from `analytics.period` so the "Statement covers X – Y" header
   * stays anchored to the whole statement even as the user filters down.
   */
  const [fullPeriod, setFullPeriod] = useState<{ from: string; to: string } | null>(null);
  const [range, setRange] = useState<RangeSelection>(ALL_TIME_SELECTION);
  const [error, setError] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  /** Cleared by the search bar when the user types or hits ESC. */
  const [searchQuery, setSearchQuery] = useState<string>(urlState.q ?? "");
  /** Guards the one-time URL → state hydration, including React Strict Mode's
   *  development-only effect replay. */
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let attempt = 0;

    const fetchAnalytics = async () => {
      attempt++;
      try {
        const res = await fetch(`/api/analytics?sessionId=${sessionId}`);
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          setAnalytics(data.analytics);
          if (data.analytics?.period) {
            setFullPeriod({
              from: new Date(data.analytics.period.from).toISOString(),
              to: new Date(data.analytics.period.to).toISOString(),
            });
          }
        } else if (res.status === 404 && attempt < 5) {
          setTimeout(fetchAnalytics, 1500);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load analytics");
        }
      } catch {
        if (!cancelled && attempt < 5) {
          setTimeout(fetchAnalytics, 2000);
        } else {
          setError("Connection failed. Please refresh.");
        }
      }
    };

    fetchAnalytics();
    return () => { cancelled = true; };
  }, [sessionId]);

  const handleReanalyze = useCallback(async () => {
    if (!sessionId || reanalyzing) return;
    setReanalyzing(true);
    try {
      const res = await fetch("/api/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics);
        // Reset filter — reanalyze rebuilds from scratch.
        setRange(ALL_TIME_SELECTION);
        setPreviousAnalytics(null);
        toast.success("Re-analysed", "Categorisation has been rebuilt from scratch.");
      }
    } catch { /* ignore */ }
    setReanalyzing(false);
  }, [sessionId, reanalyzing, toast]);

  const handleRangeChange = useCallback(
    async (next: RangeSelection, syncUrl = true) => {
      if (!sessionId) return;
      setRange(next);
      // Reflect the new range in the URL so refresh and shareable links work.
      if (syncUrl) {
        if (next.preset === "all") {
          patchUrl({ preset: null, from: null, to: null });
        } else if (next.preset === "custom" || next.preset === "month") {
          patchUrl({ preset: next.preset, from: next.from, to: next.to });
        } else {
          patchUrl({ preset: next.preset, from: null, to: null });
        }
      }
      setRangeLoading(true);
      try {
        const res = await fetch("/api/analytics/range", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            from: next.from,
            to: next.to,
            // Compare against the equally-long previous window only when a
            // sub-range is active; "All time" has nothing meaningful to
            // compare to.
            compare: next.preset !== "all" && next.from && next.to ? "previous" : null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data.analytics);
          setPreviousAnalytics(data.previous?.analytics ?? null);
        }
      } catch { /* ignore */ }
      setRangeLoading(false);
    },
    [sessionId, patchUrl]
  );

  /**
   * Hydrate `range` from URL once the statement period is known. Runs once on
   * first analytics load. After that, range changes flow URL via
   * `handleRangeChange`.
   */
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!fullPeriod) return;
    const period = { from: new Date(fullPeriod.from), to: new Date(fullPeriod.to) };
    const urlPreset = urlState.preset as RangePreset | null;
    const urlFrom = urlState.from;
    const urlTo = urlState.to;

    if (urlPreset === "custom" && urlFrom && urlTo) {
      const next: RangeSelection = {
        preset: "custom",
        from: urlFrom,
        to: urlTo,
        label: `${formatShort(new Date(urlFrom))} → ${formatShort(new Date(urlTo))}`,
      };
      // Synchronize local range state with the URL once the async statement
      // period is available; subsequent changes originate from user events.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleRangeChange(next, false);
    } else if (urlPreset === "month" && urlFrom && urlTo) {
      const f = new Date(urlFrom);
      const next: RangeSelection = {
        preset: "month",
        from: urlFrom,
        to: urlTo,
        label: f.toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
      };
      handleRangeChange(next, false);
    } else if (
      urlPreset &&
      ["this_week", "last_week", "this_month", "last_month", "last_3m", "last_6m", "ytd"].includes(urlPreset)
    ) {
      const next = computePresetRange(urlPreset as Exclude<RangePreset, "month" | "custom" | "all">, period);
      handleRangeChange(next, false);
    }
    // urlPreset === "all" / null → keep ALL_TIME_SELECTION (already set).
    hydratedRef.current = true;
    // We intentionally don't depend on urlState — only the first hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullPeriod]);

  const periodForBar = useMemo(() => {
    if (fullPeriod) return fullPeriod;
    if (analytics?.period) return analytics.period;
    return null;
  }, [fullPeriod, analytics]);

  /**
   * Tabs for the sticky section nav. Built from whichever sections actually
   * have data, so we never link to a hidden empty section.
   */
  const navSections: NavSection[] = useMemo(() => {
    if (!analytics) return [];
    const out: NavSection[] = [
      { id: "flow", label: "Flow" },
      { id: "categories", label: "Categories" },
      { id: "people", label: "People" },
    ];
    if (hasIncome(analytics) || hasInternational(analytics) || hasPromos(analytics)) {
      out.push({ id: "income", label: "Income" });
    }
    if (hasDataAirtime(analytics) || hasGlobalPay(analytics) || hasFees(analytics)) {
      out.push({ id: "services", label: "Services" });
    }
    if (hasPatterns(analytics)) out.push({ id: "patterns", label: "Patterns" });
    out.push({ id: "records", label: "Records" });
    if (hasDeepInsights(analytics)) {
      out.push({ id: "insights", label: "Insights" });
    }
    return out;
  }, [analytics]);

  /** Copies the current URL to the clipboard so the view can be shared. */
  const handleShareView = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.warn("Clipboard unavailable", "Copy the URL from the address bar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied", "Filters and currency are baked in.");
    } catch {
      toast.error("Copy failed", "Try grabbing the URL manually.");
    }
  }, [toast]);

  /**
   * The chip bar shows two kinds of "filters" the user has applied: the
   * non-default time range, and the active search query. The override count
   * is added by the chip-bar itself via context.
   */
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const out: ActiveFilter[] = [];
    if (range.preset !== "all") {
      out.push({
        id: "range",
        label: range.label,
        tone: "coral",
        onRemove: () => handleRangeChange(ALL_TIME_SELECTION),
      });
    }
    if (searchQuery.trim().length > 0) {
      out.push({
        id: "search",
        label: `Search: "${searchQuery.trim()}"`,
        tone: "default",
        onRemove: () => {
          setSearchQuery("");
          patchUrl({ q: null });
        },
      });
    }
    return out;
  }, [range, searchQuery, handleRangeChange, patchUrl]);

  if (!sessionId) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-text-muted">No session ID provided.</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose/10 ring-1 ring-rose/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold mb-2">Something broke</h2>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <Link href="/upload" className="inline-flex items-center gap-2 text-sm text-coral hover:text-coral-hover transition-colors">
            Try uploading again
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </main>
    );
  }

  if (!analytics) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-6">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-white/5" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-coral animate-spin-slow" />
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-purple animate-spin-slow" style={{ animationDirection: "reverse", animationDuration: "2.4s" }} />
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold mb-1.5">Crunching your numbers</h2>
        <p className="text-text-muted text-sm">Categorizing transactions and computing patterns...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-12">
        {/* Header bar */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 animate-fade-in">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-secondary text-xs mb-3 transition-colors">
              <span className="relative w-6 h-6 rounded-md bg-gradient-to-br from-coral via-rose to-purple flex items-center justify-center text-white font-bold text-[10px] shadow shadow-coral/30">W</span>
              Wapi Pesa
            </Link>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-none">
              Your <span className="text-gradient-coral">year</span>, decoded.
            </h1>
            <p className="text-text-muted text-sm mt-3">
              {analytics.transactionCount.toLocaleString()} transactions in <span className="text-text-secondary">{range.label}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/report?sessionId=${sessionId}`}
              aria-label="View share cards"
              title="See your shareable Reflect cards"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-full border border-coral/30 text-coral hover:text-white hover:bg-coral/15 hover:border-coral/50 transition-all min-h-[40px]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="9" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="12" width="7" height="9" rx="1.5" />
                <rect x="3" y="16" width="7" height="5" rx="1.5" />
              </svg>
              Share cards
            </Link>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Open glossary"
              title="Glossary & help"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-full border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/25 hover:bg-white/5 transition-all min-h-[40px]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M12 8h.01M11 12h1v4h1" />
              </svg>
              Help
            </button>
            <button
              type="button"
              onClick={handleShareView}
              aria-label="Copy shareable link"
              title="Copy this view as a link"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-full border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/25 hover:bg-white/5 transition-all min-h-[40px]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              Share view
            </button>
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="px-4 py-2.5 text-xs font-medium rounded-full border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 min-h-[40px]"
            >
              {reanalyzing ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 border border-text-muted/30 border-t-text-muted rounded-full animate-spin" />
                  Reanalyzing
                </span>
              ) : (
                "Reanalyze"
              )}
            </button>
            <ExportBar sessionId={sessionId} />
          </div>
        </header>

        <TimeRangeBar
          statementPeriod={periodForBar}
          selection={range}
          onChange={handleRangeChange}
          isLoading={rangeLoading}
        />

        <SearchBar
          sessionId={sessionId}
          rangeFrom={range.from}
          rangeTo={range.to}
          initialQuery={searchQuery}
          onQueryChange={(q) => {
            setSearchQuery(q);
            patchUrl({ q: q || null });
          }}
          onShowAll={(query) =>
            drill.open({
              title: `Search: ${query}`,
              subtitle: `In ${range.label}`,
              filter: { search: query, from: range.from, to: range.to },
              tone: "default",
            })
          }
        />

        <FilterChips
          filters={activeFilters}
          onClearAll={() => {
            setSearchQuery("");
            patchUrl({ q: null });
            handleRangeChange(ALL_TIME_SELECTION);
          }}
        />

        <SectionNav sections={navSections} />

        <DrillPanel
          sessionId={sessionId}
          open={!!drill.active}
          target={drill.active}
          onClose={drill.close}
          rangeLabel={range.label}
        />

        <GlossaryModal open={helpOpen} onClose={() => setHelpOpen(false)} />

        {/* Hero stats */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <OverviewCards analytics={analytics} previous={previousAnalytics} />
        </div>

        {/* Section: The flow */}
        <Section id="flow" eyebrow="The flow" title="Money in, money out." className="mt-14">
          <div className="grid lg:grid-cols-5 gap-4">
            {analytics.balanceOverTime && analytics.balanceOverTime.length > 0 ? (
              <div className="lg:col-span-3"><BalanceChart data={analytics.balanceOverTime} /></div>
            ) : null}
            <div className={analytics.balanceOverTime && analytics.balanceOverTime.length > 0 ? "lg:col-span-2" : "lg:col-span-5"}>
              <MonthlyTrends data={analytics.monthlyTrends} />
            </div>
          </div>
        </Section>

        {/* Section: Where it goes */}
        <Section id="categories" eyebrow="Where it goes" title="Spending, by shape and time.">
          <div className="grid lg:grid-cols-2 gap-4">
            <CategoryChart
              data={analytics.categoryBreakdown}
              rangeFrom={range.from}
              rangeTo={range.to}
            />
            <TimePatterns data={analytics.timePatterns} />
          </div>
        </Section>

        {/* Section: People & merchants */}
        <Section id="people" eyebrow="People & merchants" title="The names that move your money.">
          <TopRecipients
            byAmount={analytics.topCounterpartiesByAmount}
            byFrequency={analytics.topCounterpartiesByFrequency}
            personSends={analytics.personToPersonSends}
            rangeFrom={range.from}
            rangeTo={range.to}
          />
        </Section>

        {/* Section: Income & extras */}
        {(hasIncome(analytics) || hasInternational(analytics) || hasPromos(analytics)) && (
          <Section id="income" eyebrow="Money in" title="Where the inflows came from.">
            <div className="grid lg:grid-cols-3 gap-4">
              {hasIncome(analytics) && (
                <IncomeStreams
                  data={analytics.incomeStreams!}
                  rangeFrom={range.from}
                  rangeTo={range.to}
                />
              )}
              {hasInternational(analytics) && <InternationalTransfers data={analytics.internationalTransfers!} />}
              {hasPromos(analytics) && <Promotions data={analytics.promotionsAndCashback!} />}
            </div>
          </Section>
        )}

        {/* Section: Services */}
        {(hasDataAirtime(analytics) || hasGlobalPay(analytics) || hasFees(analytics)) && (
          <Section id="services" eyebrow="Services & fees" title="The small stuff, totaled up.">
            <div className="grid lg:grid-cols-3 gap-4">
              {hasDataAirtime(analytics) && <DataAirtime data={analytics.dataAndAirtime!} />}
              {hasGlobalPay(analytics) && (
                <GlobalPayMerchants
                  data={analytics.globalPayMerchants!}
                  rangeFrom={range.from}
                  rangeTo={range.to}
                />
              )}
              {hasFees(analytics) && <FeesBreakdown data={analytics.feesBreakdown!} />}
            </div>
          </Section>
        )}

        {/* Section: Recurring & loans */}
        {hasPatterns(analytics) && (
          <Section id="patterns" eyebrow="Patterns" title="What you keep paying for.">
            <div className="grid lg:grid-cols-2 gap-4">
              <RecurringPayments
                recurring={analytics.recurringPayments}
                subscriptions={analytics.subscriptions}
                rangeFrom={range.from}
                rangeTo={range.to}
              />
              <LoanSummary data={analytics.mobileLoanActivity} />
            </div>
          </Section>
        )}

        {/* Section: Records */}
        <Section id="records" eyebrow="Records" title="Your highs, lows, and streaks.">
          <StreaksExtremes
            streaks={analytics.streaks}
            extremes={analytics.extremes}
          />
        </Section>

        {/* Section: Deep insights */}
        {hasDeepInsights(analytics) && (
          <Section
            id="insights"
            eyebrow="Deep insights"
            title="Derived metrics."
            sub="Computed from your raw transaction history. The kind of stuff a good accountant would notice."
          >
            <div className="space-y-4">
              <div className="grid lg:grid-cols-3 gap-4">
                {analytics.disposableIncome && <DisposableIncomeCard data={analytics.disposableIncome} />}
                {analytics.runwayMonths && <RunwayCard data={analytics.runwayMonths} />}
                {analytics.cashFlowForecast && <CashFlowForecastCard data={analytics.cashFlowForecast} />}
              </div>
              <div className="grid lg:grid-cols-3 gap-4">
                {analytics.incomePredictability && <IncomePredictabilityCard data={analytics.incomePredictability} />}
                {analytics.trajectory && <TrajectoryCard data={analytics.trajectory} />}
                {analytics.fragilityDay && <FragilityDayCard data={analytics.fragilityDay} />}
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                {analytics.lifestyleCreep && <LifestyleCreepCard data={analytics.lifestyleCreep} />}
                {analytics.inflationExposure && <InflationExposureCard data={analytics.inflationExposure} />}
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                {analytics.leakTotal && <LeakTotalCard data={analytics.leakTotal} />}
                {analytics.counterpartyDirection && <CounterpartyDirectionCard data={analytics.counterpartyDirection} />}
              </div>
            </div>
          </Section>
        )}

        {/* Footer — trust signals */}
        <footer className="mt-20 pt-8 border-t border-white/5 space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Server-memory session
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
              30 min inactivity TTL
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7m-9 2v8m0-8h6" />
              </svg>
              No database write by default
            </span>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="hover:text-text-secondary transition-colors underline-offset-2 hover:underline"
            >
              Glossary
            </button>
            <Link href="/" className="hover:text-text-secondary transition-colors">Back to home</Link>
          </div>
          <p className="text-center text-[10px] text-text-faint">
            Wapi Pesa · Your statement, your story · v1
          </p>
        </footer>
      </div>
    </main>
  );
}

function Section({
  id,
  eyebrow,
  title,
  sub,
  children,
  className = "",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`mt-12 animate-fade-in-up scroll-mt-32 ${className}`}>
      <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">{eyebrow}</p>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
            {title}
          </h2>
        </div>
        {sub && <p className="text-text-muted text-xs max-w-sm">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function hasIncome(a: AnalyticsResult): boolean {
  return !!(a.incomeStreams && a.incomeStreams.length > 0);
}
function hasInternational(a: AnalyticsResult): boolean {
  return !!(a.internationalTransfers && a.internationalTransfers.transferCount > 0);
}
function hasPromos(a: AnalyticsResult): boolean {
  return !!(a.promotionsAndCashback && a.promotionsAndCashback.count > 0);
}
function hasDataAirtime(a: AnalyticsResult): boolean {
  return !!(a.dataAndAirtime && (a.dataAndAirtime.totalDataSpend + a.dataAndAirtime.totalAirtimeSpend) > 0);
}
function hasGlobalPay(a: AnalyticsResult): boolean {
  return !!(a.globalPayMerchants && a.globalPayMerchants.length > 0);
}
function hasFees(a: AnalyticsResult): boolean {
  return !!(a.feesBreakdown && a.feesBreakdown.totalFees > 0);
}
function hasPatterns(a: AnalyticsResult): boolean {
  const hasRecurring = a.recurringPayments.length > 0 || a.subscriptions.length > 0;
  const hasLoans = a.mobileLoanActivity.lenders.length > 0 || a.mobileLoanActivity.totalBorrowed > 0;
  return hasRecurring || hasLoans;
}
