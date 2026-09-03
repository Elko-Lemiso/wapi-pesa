"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Tiny helper to read & write a small set of URL params without re-renders
 * cascading through the whole tree. We use `router.replace` so back/forward
 * still works for the initial entry, but every subsequent change merges into
 * the current entry.
 *
 * Keys are intentionally short so shared URLs stay readable:
 *   ?from=&to=&preset=&q=&c=&private=
 */

export interface UrlState {
  from: string | null;
  to: string | null;
  preset: string | null;
  q: string | null;
  /** "USD" enables USD; absent = KES default. */
  c: string | null;
  /** "1" enables privacy mode. */
  private: string | null;
}

const KEYS: (keyof UrlState)[] = ["from", "to", "preset", "q", "c", "private"];

export function useUrlState(): {
  state: UrlState;
  patch: (next: Partial<UrlState>) => void;
  /** Read the (always-fresh) value for one key — useful in callbacks. */
  read: (key: keyof UrlState) => string | null;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<UrlState>(
    () => ({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      preset: searchParams.get("preset"),
      q: searchParams.get("q"),
      c: searchParams.get("c"),
      private: searchParams.get("private"),
    }),
    [searchParams]
  );

  const patch = useCallback(
    (next: Partial<UrlState>) => {
      // Read from `window.location` so successive patches in the same tick
      // don't lose each other (React's `searchParams` snapshot lags by one
      // render after `router.replace`).
      const live =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams(searchParams.toString());
      const before = live.toString();
      for (const key of KEYS) {
        if (!(key in next)) continue;
        const value = next[key];
        if (value === null || value === undefined || value === "") {
          live.delete(key);
        } else {
          live.set(key, String(value));
        }
      }
      const qs = live.toString();
      if (qs === before) return; // no actual change — skip the replace
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const read = useCallback(
    (key: keyof UrlState) => searchParams.get(key),
    [searchParams]
  );

  return { state, patch, read };
}
