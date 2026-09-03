"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ProcessingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin-slow w-8 h-8 border-2 border-coral/20 border-t-coral rounded-full" />
        </div>
      }
    >
      <ProcessingContent />
    </Suspense>
  );
}

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [status, setStatus] = useState("Analyzing spending patterns");

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let attempt = 0;

    const tryGenerate = async () => {
      if (cancelled) return;
      attempt++;

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            router.push(`/dashboard?sessionId=${sessionId}`);
            return;
          }
        }

        if (res.status === 404 || res.status === 500) {
          if (attempt < 10) {
            setStatus(attempt <= 2 ? "Warming up" : "Generating your report");
            setTimeout(tryGenerate, 1500);
            return;
          }
        }

        setStatus("Something went wrong. Please try uploading again.");
      } catch {
        if (cancelled) return;
        if (attempt < 10) {
          setTimeout(tryGenerate, 2000);
        } else {
          setStatus("Connection lost. Please refresh and try again.");
        }
      }
    };

    tryGenerate();

    return () => { cancelled = true; };
  }, [sessionId, router]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
      <div className="text-center max-w-md">
        <div className="relative w-28 h-28 mx-auto mb-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/5" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-coral animate-spin-slow" />
          <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-purple animate-spin-slow" style={{ animationDirection: "reverse", animationDuration: "2.4s" }} />
          <div className="absolute inset-6 rounded-full border-2 border-transparent border-t-green animate-spin-slow" style={{ animationDuration: "4s" }} />
        </div>

        <p className="eyebrow mb-3">Step 2 of 2 · Crafting</p>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          <span className="text-gradient-coral">Crunching</span> your numbers
        </h1>

        <p className="text-text-secondary animate-pulse-slow">{status}...</p>

        <div className="mt-12 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.025] text-[11px] text-text-muted">
          <svg className="w-3 h-3 text-green" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Processing in server memory
        </div>
      </div>
    </main>
  );
}
