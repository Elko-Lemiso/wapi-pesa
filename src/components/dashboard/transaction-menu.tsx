"use client";

import { useEffect, useRef, useState } from "react";
import { useOverrides } from "@/lib/overrides/context";
import { useToast } from "@/lib/toast/context";
import { CATEGORIES, type Category } from "@/lib/registry/categories";
import type { TransactionRowData } from "./transaction-row";

interface TransactionMenuProps {
  tx: TransactionRowData;
  /** The category we *think* this transaction belongs to (display label). */
  detectedCategory: string | null;
}

/**
 * "···" overflow menu attached to a transaction row. Two actions:
 *   - Recategorize → opens a small picker with the 14 canonical categories.
 *   - Rename merchant → inline input replaces the counterparty name across the
 *     entire report for this session.
 *
 * Touchscreen-friendly: 32px tap targets, dismisses on outside click and ESC.
 */
export function TransactionMenu({ tx, detectedCategory }: TransactionMenuProps) {
  const { getTxCategory, getRename, setTxCategory, setMerchantRename } = useOverrides();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"root" | "category" | "rename">("root");
  const [renameValue, setRenameValue] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const overrideCat = getTxCategory(tx.receiptNo);
  const renameCurrent = getRename(tx.counterparty.name);
  const merchantOriginal = tx.counterparty.name || "";
  const isOverridden = overrideCat !== null || renameCurrent !== null;

  // Close on ESC or outside click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) {
            setView("root");
            setRenameValue(renameCurrent ?? merchantOriginal);
          }
          setOpen(!open);
        }}
        aria-label={isOverridden ? "Edit overrides" : "Edit category or rename"}
        className={`inline-flex w-7 h-7 items-center justify-center rounded-full transition-colors ${
          isOverridden
            ? "bg-purple/15 text-purple-200 ring-1 ring-purple/30 hover:bg-purple/25"
            : "text-text-faint hover:text-text-secondary hover:bg-white/5"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-white/10 bg-[#0a1224] shadow-xl shadow-black/40 z-30 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {view === "root" && (
            <ul className="py-1">
              <MenuRow
                label="Recategorise"
                hint={overrideCat ? `Currently: ${CATEGORIES[overrideCat]}` : detectedCategory ? `Detected: ${detectedCategory}` : "Pick a category"}
                onClick={() => setView("category")}
              />
              <MenuRow
                label="Rename merchant"
                hint={renameCurrent ? `Currently: ${renameCurrent}` : "Display only, this session"}
                onClick={() => setView("rename")}
                disabled={!merchantOriginal}
              />
              {isOverridden && <Divider />}
              {overrideCat !== null && (
                <MenuRow
                  label="Reset category"
                  tone="coral"
                  onClick={() => {
                    setTxCategory(tx.receiptNo, null);
                    setOpen(false);
                  }}
                />
              )}
              {renameCurrent !== null && (
                <MenuRow
                  label="Reset rename"
                  tone="coral"
                  onClick={() => {
                    setMerchantRename(merchantOriginal, null);
                    setOpen(false);
                  }}
                />
              )}
            </ul>
          )}

          {view === "category" && (
            <CategoryPicker
              current={overrideCat}
              onPick={(c) => {
                setTxCategory(tx.receiptNo, c);
                setOpen(false);
                toast.success("Recategorised", `Now in ${CATEGORIES[c]}.`);
              }}
              onBack={() => setView("root")}
            />
          )}

          {view === "rename" && (
            <RenameInput
              original={merchantOriginal}
              value={renameValue}
              onChange={setRenameValue}
              onSubmit={() => {
                setMerchantRename(merchantOriginal, renameValue);
                setOpen(false);
                if (renameValue.trim() && renameValue.trim() !== merchantOriginal.trim()) {
                  toast.success("Renamed", `Showing as "${renameValue.trim()}".`);
                }
              }}
              onBack={() => setView("root")}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MenuRow({
  label,
  hint,
  onClick,
  disabled,
  tone = "default",
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "coral";
}) {
  const toneCls = tone === "coral" ? "text-coral hover:bg-coral/10" : "text-text-primary hover:bg-white/[0.04]";
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${toneCls} min-h-[40px]`}
      >
        <span>{label}</span>
        {hint && <span className="text-[10px] text-text-muted truncate max-w-[140px]">{hint}</span>}
      </button>
    </li>
  );
}

function Divider() {
  return <li className="my-1 border-t border-white/5" aria-hidden />;
}

function CategoryPicker({
  current,
  onPick,
  onBack,
}: {
  current: Category | null;
  onPick: (c: Category) => void;
  onBack: () => void;
}) {
  // Only the canonical taxonomy — drop legacy aliases.
  const canonical: Category[] = [
    "food_dining",
    "groceries",
    "transport",
    "utilities",
    "subscriptions",
    "banking",
    "insurance",
    "healthcare",
    "government",
    "personal",
    "domestic_services",
    "shopping",
    "self_transfer",
    "uncategorized",
  ];

  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-7 h-7 items-center justify-center rounded-full hover:bg-white/5 text-text-muted hover:text-text-primary"
          aria-label="Back"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Pick category</p>
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {canonical.map((key) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onPick(key)}
              className={`flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition-colors min-h-[36px] ${
                current === key
                  ? "bg-purple/15 text-purple-200"
                  : "text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
              }`}
            >
              <span>{CATEGORIES[key]}</span>
              {current === key && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RenameInput({
  original,
  value,
  onChange,
  onSubmit,
  onBack,
}: {
  original: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-7 h-7 items-center justify-center rounded-full hover:bg-white/5 text-text-muted hover:text-text-primary"
          aria-label="Back"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Rename merchant</p>
      </div>
      <p className="text-[11px] text-text-muted mb-2">
        Show <span className="font-mono text-text-secondary">{original}</span> as:
      </p>
      <input
        type="text"
        value={value}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple/40 focus:ring-2 focus:ring-purple/20"
        placeholder="New display name"
      />
      <div className="flex justify-end mt-2 gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-text-secondary hover:text-text-primary min-h-[32px]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={value.trim().length < 2}
          className="text-xs px-3 py-1.5 rounded-full border border-purple/30 bg-purple/15 text-purple-100 hover:bg-purple/25 disabled:opacity-40 disabled:cursor-not-allowed min-h-[32px]"
        >
          Save
        </button>
      </div>
    </div>
  );
}
