"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Lightweight toast system. No external deps — just a context + a viewport
 * fixed to the bottom-right of the page.
 *
 *   const { toast } = useToast();
 *   toast({ title: "Copied", description: "Link is on your clipboard" });
 *   toast.success("Customised");
 *   toast.error("Couldn't reach the server");
 */

export type ToastTone = "info" | "success" | "warn" | "error";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms to live (default 4000). Set to 0 for sticky. */
  duration?: number;
}

interface ToastInstance extends Required<Omit<ToastOptions, "description">> {
  id: number;
  description: string | undefined;
}

interface ToastContextValue {
  toast: ((opts: ToastOptions) => void) & {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
    warn: (title: string, description?: string) => void;
  };
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function createToastDispatcher(
  push: (opts: ToastOptions) => void
): ToastContextValue["toast"] {
  return Object.assign((opts: ToastOptions) => push(opts), {
    success: (title: string, description?: string) =>
      push({ title, description, tone: "success" }),
    error: (title: string, description?: string) =>
      push({ title, description, tone: "error" }),
    info: (title: string, description?: string) =>
      push({ title, description, tone: "info" }),
    warn: (title: string, description?: string) =>
      push({ title, description, tone: "warn" }),
  });
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastInstance[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (opts: ToastOptions) => {
      const id = Date.now() + Math.random();
      const instance: ToastInstance = {
        id,
        title: opts.title,
        description: opts.description,
        tone: opts.tone ?? "info",
        duration: opts.duration ?? 4000,
      };
      setItems((prev) => [...prev, instance].slice(-5)); // cap at 5 visible
      if (instance.duration > 0) {
        window.setTimeout(() => dismiss(id), instance.duration);
      }
    },
    [dismiss]
  );

  const toast = useMemo(() => createToastDispatcher(push), [push]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const NOOP_CTX: ToastContextValue = {
  toast: createToastDispatcher(() => {}),
  dismiss: () => {},
};

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? NOOP_CTX;
}

// =============================================================================
// Viewport
// =============================================================================

const TONE_CLASSES: Record<ToastTone, string> = {
  info: "border-white/15 bg-[#0a1224] text-text-primary",
  success: "border-green/30 bg-green/[0.08] text-text-primary",
  warn: "border-gold/40 bg-gold/[0.08] text-text-primary",
  error: "border-rose/40 bg-rose/[0.08] text-text-primary",
};

const TONE_DOT: Record<ToastTone, string> = {
  info: "bg-text-muted",
  success: "bg-green",
  warn: "bg-gold",
  error: "bg-rose",
};

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastInstance[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {items.map((t) => (
        <ToastCard key={t.id} t={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ t, onDismiss }: { t: ToastInstance; onDismiss: () => void }) {
  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnter(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="status"
      className={`pointer-events-auto w-72 sm:w-80 rounded-xl border ${TONE_CLASSES[t.tone]} shadow-xl shadow-black/40 backdrop-blur-md transition-all duration-200 ${
        enter ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          aria-hidden
          className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${TONE_DOT[t.tone]}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{t.title}</p>
          {t.description && (
            <p className="text-[12px] text-text-secondary mt-0.5 leading-snug">{t.description}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex-shrink-0 inline-flex w-6 h-6 items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
