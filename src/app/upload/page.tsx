"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CLIENT_PAYMENTS_ENABLED } from "@/lib/client-features";

type Mode = "reflect" | "understand";
type UnderstandPeriod = "single_month" | "annual";


const PROGRESS_STAGES: { label: string; minDurationMs: number }[] = [
  { label: "Reading PDF", minDurationMs: 1500 },
  { label: "Parsing transactions", minDurationMs: 4000 },
  { label: "Categorizing", minDurationMs: 3500 },
  { label: "Computing insights", minDurationMs: 3000 },
  { label: "Generating report", minDurationMs: 2500 },
];

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin-slow w-8 h-8 border-2 border-coral/20 border-t-coral rounded-full" />
        </div>
      }
    >
      <UploadContent />
    </Suspense>
  );
}

function UploadContent() {
  const [serverEnabled, setServerEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/capabilities", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((capabilities) => {
        if (!cancelled) setServerEnabled(capabilities?.statementProcessing === true);
      })
      .catch(() => {
        if (!cancelled) setServerEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!serverEnabled) {
    return <PublicPreviewNotice />;
  }

  return <ActiveUploadContent />;
}

function PublicPreviewNotice() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-3xl glass-strong p-8 sm:p-12 text-center">
        <p className="eyebrow mb-4">Public preview</p>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-5">
          Your statement stays yours.
        </h1>
        <p className="text-text-secondary leading-relaxed max-w-md mx-auto mb-8">
          This showcase demonstrates Wapi Pesa without accepting financial documents or initiating payments. Statement processing remains gated until the production privacy and security work is complete.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/#sample"
            className="px-5 py-3 rounded-full bg-gradient-to-r from-coral to-rose text-white text-sm font-semibold"
          >
            View sample report
          </Link>
          <Link
            href="/"
            className="px-5 py-3 rounded-full border border-white/15 text-text-primary text-sm hover:bg-white/5 transition-colors"
          >
            Back to Wapi Pesa
          </Link>
        </div>
      </div>
    </main>
  );
}

function ActiveUploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("mode") as Mode) || "reflect";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [period, setPeriod] = useState<UnderstandPeriod>("annual");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);

  // Drive the multi-stage progress while the parse is in flight. We advance
  // through each stage at its `minDurationMs` and stick on the final one until
  // the network actually returns. Stays within the privacy posture — nothing
  // here triggers any extra request.
  useEffect(() => {
    if (!isUploading) return;
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      const next = i + 1;
      if (next >= PROGRESS_STAGES.length) return; // hold on the final stage
      i = next;
      setStageIndex(i);
      window.setTimeout(tick, PROGRESS_STAGES[i].minDurationMs);
    };
    const t = window.setTimeout(tick, PROGRESS_STAGES[0].minDurationMs);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isUploading]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
      setError(null);
    } else {
      setError("Please upload a PDF file");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setIsUploading(true);
    setStageIndex(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      // PIN is optional — only attached when the user has entered one. The
      // server happily handles unlocked statements without a password.
      if (password) formData.append("password", password);
      formData.append("mode", mode);
      if (mode === "understand") {
        formData.append("period", period);
      }

      const response = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Upload failed");
        setIsUploading(false);
        return;
      }

      setPassword("");

      if (CLIENT_PAYMENTS_ENABLED) {
        const paymentParams = new URLSearchParams({
          sessionId: data.sessionId,
          mode,
        });
        if (mode === "understand") paymentParams.set("period", period);
        router.push(`/payment?${paymentParams.toString()}`);
        return;
      }

      if (mode === "reflect") {
        router.push(`/report?sessionId=${data.sessionId}`);
      } else {
        router.push(`/dashboard?sessionId=${data.sessionId}`);
      }
    } catch {
      setError("Upload failed. Please try again.");
      setIsUploading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col">
      <nav className="px-6 lg:px-10 pt-6 max-w-3xl mx-auto w-full">
        <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-secondary text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Link>
      </nav>

      <div className="flex-1 flex items-start justify-center px-6 py-12 lg:py-16">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-12 animate-fade-in-up">
            <p className="eyebrow mb-3">Step 1 of 2 · Upload</p>
            <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
              Drop in your <span className="text-gradient-coral">statement</span>.
            </h1>
            <p className="text-text-secondary text-base max-w-md mx-auto">
              The PDF is uploaded to the app server and processed in server memory. The application does not intentionally persist it to disk or a database. If a PIN is supplied, it is used for decryption and is not retained by the application.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="relative grid grid-cols-2 rounded-2xl glass p-1 mb-8 animate-fade-in-up">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ${
                mode === "reflect" ? "left-1 bg-coral/15 ring-1 ring-coral/25" : "left-[calc(50%+0px)] bg-green/15 ring-1 ring-green/25"
              }`}
            />
            <button
              onClick={() => setMode("reflect")}
              className={`relative py-3 px-4 rounded-xl text-sm font-semibold transition-colors ${
                mode === "reflect" ? "text-coral" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Reflect{CLIENT_PAYMENTS_ENABLED ? " · KES 300" : ""}
            </button>
            <button
              onClick={() => setMode("understand")}
              className={`relative py-3 px-4 rounded-xl text-sm font-semibold transition-colors ${
                mode === "understand" ? "text-green" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Understand{CLIENT_PAYMENTS_ENABLED ? " · from KES 800" : ""}
            </button>
          </div>

          {mode === "understand" && (
            <div className="mb-8 animate-fade-in">
              <p className="eyebrow mb-3">Report period</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPeriod("annual")}
                  className={`group rounded-2xl p-4 text-left border transition-all ${
                    period === "annual"
                      ? "border-green/40 bg-green/5"
                      : "border-white/5 hover:border-white/15 bg-white/[0.02]"
                  }`}
                >
                  <p className="text-sm font-semibold text-text-primary">Annual</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Full year{CLIENT_PAYMENTS_ENABLED ? " · KES 2,000" : ""}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("single_month")}
                  className={`group rounded-2xl p-4 text-left border transition-all ${
                    period === "single_month"
                      ? "border-green/40 bg-green/5"
                      : "border-white/5 hover:border-white/15 bg-white/[0.02]"
                  }`}
                >
                  <p className="text-sm font-semibold text-text-primary">Single month</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    One month{CLIENT_PAYMENTS_ENABLED ? " · KES 800" : ""}
                  </p>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in-up">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative rounded-3xl p-12 text-center transition-all cursor-pointer overflow-hidden border-2 border-dashed ${
                isDragging
                  ? mode === "reflect"
                    ? "border-coral bg-coral/5"
                    : "border-green bg-green/5"
                  : file
                    ? "border-green/40 bg-green/[0.04]"
                    : "border-white/10 hover:border-white/25 bg-white/[0.015]"
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              {file ? (
                <div className="space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green/15 ring-1 ring-green/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-text-primary">{file.name}</p>
                  <p className="text-xs text-text-muted">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · click to replace
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-base font-medium text-text-primary">
                    Drop your M-Pesa statement PDF
                  </p>
                  <p className="text-xs text-text-muted">or click anywhere to browse</p>
                </div>
              )}
            </div>

            {/* Password — optional. Safaricom statements arrive locked,
                but plenty of users upload PDFs they've already unlocked
                (re-saved from a viewer, generated without a PIN, etc.). */}
            <div className="rounded-2xl glass p-5">
              <div className="flex items-baseline justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-text-primary">
                  Statement PIN
                </label>
                <span className="text-[11px] text-text-muted uppercase tracking-wider">Optional</span>
              </div>
              <p className="text-xs text-text-muted mb-3 leading-relaxed">
                Safaricom SMSes a 6-digit PIN when you request a statement. Enter it if your PDF is locked. If you&apos;ve already removed the password — or never had one — leave this blank.
              </p>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank if your PDF is unlocked"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3.5 text-text-primary placeholder:text-text-faint focus:outline-none focus:border-coral/40 focus:ring-2 focus:ring-coral/20 transition-all font-mono tracking-[0.2em]"
                autoComplete="off"
                inputMode="numeric"
                maxLength={6}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
                {error}
              </div>
            )}

            {isUploading ? (
              <ProgressPanel mode={mode} stageIndex={stageIndex} />
            ) : (
              <button
                type="submit"
                disabled={!file}
                className={`w-full font-semibold py-4 rounded-2xl transition-all text-base min-h-[48px] ${
                  mode === "reflect"
                    ? "bg-gradient-to-br from-coral to-rose text-white shadow-lg shadow-coral/30 hover:shadow-coral/50 hover:-translate-y-0.5"
                    : "bg-gradient-to-br from-green to-emerald-500 text-navy shadow-lg shadow-green/30 hover:shadow-green/50 hover:-translate-y-0.5"
                } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none`}
              >
                Analyze my statement
              </button>
            )}
          </form>

          {/* Trust strip */}
          <div className="mt-10 flex items-center justify-center gap-x-6 gap-y-2 flex-wrap text-[11px] text-text-muted">
            <TrustPill text="Processed in server memory" />
            <TrustPill text="PIN not intentionally retained" />
            <TrustPill text="30 min inactivity TTL" />
          </div>
        </div>
      </div>
    </main>
  );
}

function ProgressPanel({ mode, stageIndex }: { mode: Mode; stageIndex: number }) {
  const accent = mode === "reflect" ? "coral" : "green";
  const accentText = accent === "coral" ? "text-coral" : "text-green";
  const accentRing = accent === "coral" ? "ring-coral/30" : "ring-green/30";
  const accentBar = accent === "coral" ? "from-coral to-rose" : "from-green to-emerald-500";
  const totalStages = PROGRESS_STAGES.length;
  const pct = Math.min(100, Math.round(((stageIndex + 0.6) / totalStages) * 100));
  return (
    <div className={`rounded-2xl glass p-5 ring-1 ${accentRing}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="relative inline-flex w-10 h-10 rounded-full bg-white/5 items-center justify-center flex-shrink-0">
          <svg className={`animate-spin h-5 w-5 ${accentText}`} viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Working</p>
          <p className="text-base font-semibold text-text-primary">
            {PROGRESS_STAGES[stageIndex]?.label || PROGRESS_STAGES[totalStages - 1].label}
            <span className="text-text-muted font-normal animate-pulse">…</span>
          </p>
        </div>
      </div>

      <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden mb-4">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${accentBar} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="space-y-1.5">
        {PROGRESS_STAGES.map((stage, i) => {
          const isDone = i < stageIndex;
          const isActive = i === stageIndex;
          return (
            <li key={stage.label} className="flex items-center gap-2.5 text-[12px]">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                  isDone
                    ? `${accentText} bg-white/10`
                    : isActive
                      ? `${accentText} bg-white/5 ring-1 ${accentRing}`
                      : "text-text-faint bg-white/[0.03]"
                }`}
                aria-hidden
              >
                {isDone ? "✓" : isActive ? "·" : ""}
              </span>
              <span className={isDone ? "text-text-secondary" : isActive ? "text-text-primary" : "text-text-faint"}>
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-[11px] text-text-muted mt-4 leading-relaxed">
        Your statement is being analyzed in server memory. Any PIN you supplied was sent to this server for decryption and is not intentionally logged or retained by the application.
      </p>
    </div>
  );
}

function TrustPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg className="w-3 h-3 text-green" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      {text}
    </span>
  );
}
