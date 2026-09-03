"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DrillTarget } from "./drill-panel";

interface DrillContextValue {
  open: (target: DrillTarget) => void;
  close: () => void;
  active: DrillTarget | null;
}

const DrillContext = createContext<DrillContextValue | null>(null);

export function DrillProvider({
  children,
  onChange,
}: {
  children: ReactNode;
  /** Notified whenever the active drill changes. Used by the dashboard host to
   * actually mount the side panel — we keep state local here for ergonomics. */
  onChange?: (target: DrillTarget | null) => void;
}) {
  const [active, setActive] = useState<DrillTarget | null>(null);

  const open = useCallback(
    (target: DrillTarget) => {
      setActive(target);
      onChange?.(target);
    },
    [onChange]
  );

  const close = useCallback(() => {
    setActive(null);
    onChange?.(null);
  }, [onChange]);

  const value = useMemo(() => ({ open, close, active }), [open, close, active]);
  return <DrillContext.Provider value={value}>{children}</DrillContext.Provider>;
}

export function useDrill(): DrillContextValue {
  const ctx = useContext(DrillContext);
  if (ctx) return ctx;
  // Fallback no-op so cards rendered outside the dashboard (e.g. preview shots)
  // don't crash.
  return { open: () => {}, close: () => {}, active: null };
}
