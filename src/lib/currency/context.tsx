"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Currency = "KES" | "USD";

// Hardcoded conversion rate as of statement reference date.
// Surfaced in UI as a footer note so users know it's a fixed snapshot.
export const USD_PER_KES = 1 / 130; // ≈ KES 130 per USD as of mid-2026
export const RATE_AS_OF = "May 2026";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggle: () => void;
  /**
   * Privacy mode obscures money values for screen sharing — formatters
   * return `••••` instead of the actual figure. Currency-specific behaviour
   * (compact, decimals) is preserved on the visible width so layout doesn't
   * shift when the toggle flips.
   */
  privacyMode: boolean;
  setPrivacyMode: (v: boolean) => void;
  togglePrivacy: () => void;
  /**
   * Convert a KES-denominated number into the active currency. Always pass raw
   * KES — the active currency conversion happens here.
   */
  convert: (kes: number) => number;
  format: (kes: number, opts?: FormatOptions) => string;
  /**
   * Render a tiny code/symbol prefix for inline labels (used by some headings
   * that don't go through `format`).
   */
  symbol: string;
}

interface FormatOptions {
  compact?: boolean;
  decimals?: number;
  /** Force sign (+/-) prefix on positive numbers too. */
  signed?: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  children,
  initialCurrency = "KES",
  initialPrivacyMode = false,
  onCurrencyChange,
  onPrivacyChange,
}: {
  children: ReactNode;
  initialCurrency?: Currency;
  initialPrivacyMode?: boolean;
  onCurrencyChange?: (c: Currency) => void;
  onPrivacyChange?: (v: boolean) => void;
}) {
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);
  const [privacyMode, setPrivacyModeState] = useState<boolean>(initialPrivacyMode);

  const setCurrency = useCallback(
    (c: Currency) => {
      setCurrencyState(c);
      onCurrencyChange?.(c);
    },
    [onCurrencyChange]
  );

  const setPrivacyMode = useCallback(
    (v: boolean) => {
      setPrivacyModeState(v);
      onPrivacyChange?.(v);
    },
    [onPrivacyChange]
  );

  const toggle = useCallback(() => {
    const next = currency === "KES" ? "USD" : "KES";
    setCurrencyState(next);
    onCurrencyChange?.(next);
  }, [currency, onCurrencyChange]);

  const togglePrivacy = useCallback(() => {
    setPrivacyModeState((p) => {
      const next = !p;
      onPrivacyChange?.(next);
      return next;
    });
  }, [onPrivacyChange]);

  const convert = useCallback(
    (kes: number) => (currency === "KES" ? kes : kes * USD_PER_KES),
    [currency]
  );

  const format = useCallback(
    (kes: number, opts: FormatOptions = {}) => {
      if (privacyMode) {
        return formatRedacted(kes, currency, opts);
      }
      const value = convert(kes);
      return formatAmount(value, currency, opts);
    },
    [currency, convert, privacyMode]
  );

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      toggle,
      privacyMode,
      setPrivacyMode,
      togglePrivacy,
      convert,
      format,
      symbol: currency === "KES" ? "KES" : "USD",
    }),
    [currency, setCurrency, toggle, privacyMode, setPrivacyMode, togglePrivacy, convert, format]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider — keeps the UI
    // working at KES even if a card slips out of the tree (e.g. share cards).
    return FALLBACK_CTX;
  }
  return ctx;
}

/**
 * Tiny hook that returns the formatter directly. Most components only need to
 * format an amount in the active currency.
 */
export function useFormatMoney(): (kes: number, opts?: FormatOptions) => string {
  return useCurrency().format;
}

function formatAmount(
  value: number,
  currency: Currency,
  { compact = false, decimals, signed = false }: FormatOptions
): string {
  const sign = signed && value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const code = currency;

  if (compact) {
    return `${sign}${code} ${formatCompact(abs, currency)}`;
  }

  const fractionDigits =
    decimals ??
    (currency === "USD"
      ? abs >= 1000
        ? 0
        : 2
      : abs >= 1000
        ? 0
        : 0);

  const formatted = abs.toLocaleString(currency === "USD" ? "en-US" : "en-KE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  return `${sign}${code} ${formatted}`;
}

function formatCompact(abs: number, currency: Currency): string {
  // USD compacts at thousand boundary; KES at the same.
  if (abs >= 1_000_000) {
    return `${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${(abs / 1_000).toFixed(currency === "USD" ? 2 : 1)}K`;
  }
  return abs.toLocaleString(currency === "USD" ? "en-US" : "en-KE", {
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  });
}

/**
 * Privacy-mode rendering: replace the digits with bullets while preserving the
 * currency code and approximate width so layout doesn't shift when toggled.
 *
 * We use the magnitude of the unredacted figure to pick how many bullets to
 * draw (so KES 12 stays narrow, KES 12,400,000 stays wide). Magnitude alone
 * leaks no values — anyone with eyes can see "this is a big bill" already.
 */
function formatRedacted(kes: number, currency: Currency, opts: FormatOptions): string {
  const abs = Math.abs(kes);
  const code = currency;
  const sign = opts.signed && kes > 0 ? "+" : kes < 0 ? "-" : "";

  if (opts.compact) {
    if (abs >= 1_000_000) return `${sign}${code} ••.•M`;
    if (abs >= 1_000) return `${sign}${code} •••K`;
    return `${sign}${code} •••`;
  }

  // Approximate width in digits using log10 of the converted amount
  const converted = currency === "USD" ? abs * USD_PER_KES : abs;
  const intPart = converted >= 1 ? Math.floor(Math.log10(converted)) + 1 : 1;
  const groups = Math.ceil(intPart / 3);
  const widths = [];
  let remaining = intPart;
  for (let i = 0; i < groups; i++) {
    const chunk = i === 0 ? ((remaining - 1) % 3) + 1 : 3;
    widths.push("•".repeat(chunk));
    remaining -= chunk;
  }
  const intStr = widths.join(",");
  const fractionDigits = opts.decimals ?? (currency === "USD" && abs < 1000 ? 2 : 0);
  const fracStr = fractionDigits > 0 ? `.${"•".repeat(fractionDigits)}` : "";
  return `${sign}${code} ${intStr}${fracStr}`;
}

const FALLBACK_CTX: CurrencyContextValue = {
  currency: "KES",
  setCurrency: () => {},
  toggle: () => {},
  privacyMode: false,
  setPrivacyMode: () => {},
  togglePrivacy: () => {},
  convert: (kes: number) => kes,
  format: (kes: number, opts: FormatOptions = {}) => formatAmount(kes, "KES", opts),
  symbol: "KES",
};
