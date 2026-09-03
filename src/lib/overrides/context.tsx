"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Category } from "@/lib/registry/categories";

/**
 * User-supplied overrides — Layer 6 of the categorisation system.
 *
 * Stored per session in `sessionStorage` (so a refresh in the same tab keeps
 * tweaks) but never sent to the server, never persisted to disk on the
 * backend. Cleared automatically when the tab closes.
 *
 * Two flavours:
 *   - **Transaction category override**: pin a single transaction to a
 *     different category than the auto-detected one. Keyed by receiptNo.
 *   - **Merchant rename**: rename a merchant for display only. Affects every
 *     transaction whose counterparty matches (case-insensitive substring or
 *     exact match against the original name).
 */

const STORAGE_VERSION = 1;

interface PersistShape {
  v: number;
  txCategory: Record<string, Category>;
  merchantRename: Record<string, string>;
}

interface OverrideContextValue {
  /** Returns the override category for a tx, or null if untouched. */
  getTxCategory: (receiptNo: string) => Category | null;
  /** Returns a renamed merchant for a counterparty name, or null. */
  getRename: (originalName: string | null | undefined) => string | null;
  setTxCategory: (receiptNo: string, category: Category | null) => void;
  setMerchantRename: (originalName: string, customName: string | null) => void;
  /** Reset everything in this session. */
  clearAll: () => void;
  /** Total count of active overrides — useful for the chip bar / glossary. */
  count: number;
}

const OverrideContext = createContext<OverrideContextValue | null>(null);

interface OverrideProviderProps {
  children: ReactNode;
  /** Scope key — usually the sessionId so two reports in different tabs don't collide. */
  scopeId: string | null;
}

export function OverrideProvider({ children, scopeId }: OverrideProviderProps) {
  const storageKey = scopeId ? `wp:overrides:${scopeId}` : null;

  const [txCategory, setTxCategoryState] = useState<Record<string, Category>>({});
  const [merchantRename, setMerchantRenameState] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- This effect hydrates
     * React state from the browser's external sessionStorage system. */
    if (!storageKey) {
      setHydrated(true);
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistShape;
        if (parsed && parsed.v === STORAGE_VERSION) {
          setTxCategoryState(parsed.txCategory || {});
          setMerchantRenameState(parsed.merchantRename || {});
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [storageKey]);

  // Persist on change
  useEffect(() => {
    if (!hydrated || !storageKey) return;
    try {
      const payload: PersistShape = {
        v: STORAGE_VERSION,
        txCategory,
        merchantRename,
      };
      window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      /* quota exceeded — silently drop */
    }
  }, [hydrated, storageKey, txCategory, merchantRename]);

  const setTxCategory = useCallback((receiptNo: string, category: Category | null) => {
    setTxCategoryState((prev) => {
      const next = { ...prev };
      if (category === null) {
        delete next[receiptNo];
      } else {
        next[receiptNo] = category;
      }
      return next;
    });
  }, []);

  const setMerchantRename = useCallback((originalName: string, customName: string | null) => {
    const key = originalName.trim().toUpperCase();
    if (!key) return;
    setMerchantRenameState((prev) => {
      const next = { ...prev };
      if (!customName || customName.trim().length === 0 || customName.trim() === originalName.trim()) {
        delete next[key];
      } else {
        next[key] = customName.trim();
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setTxCategoryState({});
    setMerchantRenameState({});
  }, []);

  const getTxCategory = useCallback(
    (receiptNo: string) => txCategory[receiptNo] ?? null,
    [txCategory]
  );

  const getRename = useCallback(
    (name: string | null | undefined) => {
      if (!name) return null;
      const key = name.trim().toUpperCase();
      return merchantRename[key] ?? null;
    },
    [merchantRename]
  );

  const count = Object.keys(txCategory).length + Object.keys(merchantRename).length;

  const value = useMemo<OverrideContextValue>(
    () => ({
      getTxCategory,
      getRename,
      setTxCategory,
      setMerchantRename,
      clearAll,
      count,
    }),
    [getTxCategory, getRename, setTxCategory, setMerchantRename, clearAll, count]
  );

  return <OverrideContext.Provider value={value}>{children}</OverrideContext.Provider>;
}

const NOOP_CTX: OverrideContextValue = {
  getTxCategory: () => null,
  getRename: () => null,
  setTxCategory: () => {},
  setMerchantRename: () => {},
  clearAll: () => {},
  count: 0,
};

export function useOverrides(): OverrideContextValue {
  const ctx = useContext(OverrideContext);
  return ctx ?? NOOP_CTX;
}
