"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ToastProvider, useToast } from "@/lib/toast/context";
import { CLIENT_PAYMENTS_ENABLED } from "@/lib/client-features";

interface CardManifestEntry {
  id: string;
  index: number;
  total: number;
  cardType: string;
  accent: string;
  headline: string;
  tagline: string;
  storyKey: string;
  posterKey: string;
  storyKeyPrivate?: string;
  posterKeyPrivate?: string;
  hasName?: boolean;
}

const ACCENT_HEX: Record<string, string> = {
  white: "#f4f6fb",
  coral: "#ff6a4a",
  teal: "#2dd4bf",
  purple: "#a78bfa",
  amber: "#f5b731",
  blue: "#60a5fa",
  gold: "#facc15",
  magenta: "#ec4899",
  neutral: "#f4f6fb",
  multi: "#ff6a4a",
};

const CARD_TYPE_LABELS: Record<string, string> = {
  headline: "Headline",
  topRecipient: "Top recipient",
  topMerchant: "Top merchant",
  lateNight: "Late night",
  fuliza: "Fuliza",
  subscriptions: "Subscriptions",
  billsMap: "Bills map",
  peopleMap: "People map",
  biggestDay: "Biggest day",
  punchline: "Punchline",
  stats: "Stats",
  transport: "Transport",
  international: "International",
  generosity: "Generosity",
  travel: "Travel",
  recovery: "Recovery",
};

// Each card auto-advances after this much wall time. Holding the screen
// pauses; tapping left/right scrubs immediately.
const STORY_DURATION_MS = 6500;

export default function ReportPage() {
  return (
    <ToastProvider>
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center min-h-screen">
            <div className="animate-spin-slow w-8 h-8 border-2 border-coral/20 border-t-coral rounded-full" />
          </div>
        }
      >
        <ReportContent />
      </Suspense>
    </ToastProvider>
  );
}

function ReportContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const { toast } = useToast();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [cards, setCards] = useState<CardManifestEntry[]>([]);
  const [isDeleted, setIsDeleted] = useState(false);

  // Story playback state
  const [mode, setMode] = useState<"story" | "recap">("story");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 within the current card
  const progressRef = useRef(0);

  // Recap helpers
  const [previewCard, setPreviewCard] = useState<CardManifestEntry | null>(null);
  const [previewVariant, setPreviewVariant] = useState<"story" | "poster">("story");
  const [email, setEmail] = useState("");
  const [emailMarketingOptIn, setEmailMarketingOptIn] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Mask names — when on, every card with a name on it is swapped for the
  // pre-rendered initials variant. Toggling this is instant; no re-fetch.
  const [maskNames, setMaskNames] = useState(false);

  /** Resolve the right asset key, honouring the mask-names toggle. */
  const resolveKey = useCallback(
    (card: CardManifestEntry, variant: "story" | "poster"): string => {
      if (maskNames && card.hasName) {
        const masked = variant === "story" ? card.storyKeyPrivate : card.posterKeyPrivate;
        if (masked) return masked;
      }
      return variant === "story" ? card.storyKey : card.posterKey;
    },
    [maskNames]
  );

  // ---------------------------------------------------------------------------
  // Polling: fetch the cards manifest. If we land on `parsed`/`payment_confirmed`
  // (typical in dev where payment is skipped) kick off generation ourselves.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let kicked = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pay/mpesa/status?sessionId=${sessionId}`);
        if (!res.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "delivered") {
          setCards(Array.isArray(data.cards) ? data.cards : []);
          setStatus("ready");
          return;
        }

        if (data.status === "deleted") {
          setIsDeleted(true);
          return;
        }

        const canGenerate =
          data.status === "payment_confirmed" ||
          (!CLIENT_PAYMENTS_ENABLED && data.status === "parsed");
        if (!kicked && canGenerate) {
          kicked = true;
          fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          }).catch(() => {
            /* poller will surface any persistent failure */
          });
        }

        if (
          data.status === "parsed" ||
          data.status === "payment_confirmed" ||
          data.status === "generating"
        ) {
          setTimeout(poll, 2000);
        } else {
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // ---------------------------------------------------------------------------
  // Story auto-advance: a single RAF loop driven by `currentIndex`/`paused`/
  // `mode`. Progress is held in a ref so pausing/unpausing doesn't reset it.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (mode !== "story" || status !== "ready" || cards.length === 0 || paused) {
      return;
    }
    let raf = 0;
    let lastNow: number | null = null;

    const tick = (now: number) => {
      if (lastNow === null) lastNow = now;
      const dt = now - lastNow;
      lastNow = now;
      const next = progressRef.current + dt / STORY_DURATION_MS;

      if (next >= 1) {
        if (currentIndex >= cards.length - 1) {
          progressRef.current = 1;
          setProgress(1);
          setMode("recap");
          return;
        }
        progressRef.current = 0;
        setProgress(0);
        setCurrentIndex((i) => i + 1);
        return;
      }

      progressRef.current = next;
      setProgress(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, status, cards.length, paused, currentIndex]);

  // Reset per-card progress whenever the active card changes via tap/keys.
  useEffect(() => {
    progressRef.current = 0;
    // This mirrors the imperative playback ref after keyboard/tap navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(0);
  }, [currentIndex]);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------
  const goNext = useCallback(() => {
    setCurrentIndex((i) => {
      if (i >= cards.length - 1) {
        setMode("recap");
        return i;
      }
      return i + 1;
    });
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const replay = useCallback(() => {
    setCurrentIndex(0);
    progressRef.current = 0;
    setProgress(0);
    setPaused(false);
    setMode("story");
  }, []);

  const jumpTo = useCallback((index: number) => {
    setCurrentIndex(index);
    progressRef.current = 0;
    setProgress(0);
    setPaused(false);
    setMode("story");
  }, []);

  // Keyboard: arrows, space, escape — only active in story mode.
  useEffect(() => {
    if (mode !== "story") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMode("recap");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, goNext, goPrev]);

  // Lock body scroll while in story mode (full-bleed playback).
  useEffect(() => {
    if (mode !== "story") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mode]);

  // ---------------------------------------------------------------------------
  // Download / share helpers
  // ---------------------------------------------------------------------------
  const downloadUrl = useCallback(
    (key: string) => `/api/download?sessionId=${sessionId}&type=card&card=${encodeURIComponent(key)}`,
    [sessionId]
  );

  const handleDownload = (type: "pdf" | "csv") => {
    window.open(`/api/download?sessionId=${sessionId}&type=${type}`, "_blank");
    toast.info(type === "pdf" ? "Generating PDF" : "Generating CSV", "Your download will start shortly.");
  };

  const handleSaveCard = (card: CardManifestEntry, variant: "story" | "poster") => {
    const key = resolveKey(card, variant);
    window.open(downloadUrl(key), "_blank");
    toast.success(
      `Saving ${variant === "story" ? "story" : "poster"}${maskNames && card.hasName ? " (masked)" : ""}`,
      `${CARD_TYPE_LABELS[card.cardType] || card.cardType} · ${variant === "story" ? "1080×1920" : "1200×675"}`
    );
  };

  const handleCopyLink = async (card: CardManifestEntry, variant: "story" | "poster") => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.warn("Clipboard unavailable", "Use Save to download and share manually.");
      return;
    }
    const url = new URL(downloadUrl(resolveKey(card, variant)), window.location.origin);
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("Link copied", "Paste into your story or chat.");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionId) return;
    const confirmed = window.confirm(
      "This will permanently delete all data from this session. Your downloads and share cards will stop working. Continue?"
    );
    if (!confirmed) return;
    await fetch("/api/delete-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    setIsDeleted(true);
  };

  const handleEmailReport = async () => {
    if (!email || !sessionId) return;
    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.error || "The email could not be sent.");
      }
      setEmailSent(true);
      toast.success("Sent", `Look in your inbox at ${email}.`);
    } catch (error) {
      toast.error(
        "Couldn't send email",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Render branches
  // ---------------------------------------------------------------------------
  if (!sessionId) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-text-muted">Invalid session.</p>
      </main>
    );
  }

  if (isDeleted) return <DeletedScreen />;
  if (status === "loading") return <LoadingScreen />;
  if (status === "error") return <ErrorScreen />;
  if (cards.length === 0) return <EmptyScreen sessionId={sessionId} />;

  const activeCard = cards[Math.min(currentIndex, cards.length - 1)];

  if (mode === "story") {
    return (
      <StoryPlayer
        cards={cards}
        currentIndex={currentIndex}
        progress={progress}
        paused={paused}
        downloadUrl={downloadUrl}
        resolveKey={resolveKey}
        maskNames={maskNames}
        onToggleMask={() => setMaskNames((m) => !m)}
        onPauseStart={() => setPaused(true)}
        onPauseEnd={() => setPaused(false)}
        onTogglePause={() => setPaused((p) => !p)}
        onPrev={goPrev}
        onNext={goNext}
        onExit={() => setMode("recap")}
        onSave={(variant) => handleSaveCard(activeCard, variant)}
        onCopyLink={(variant) => handleCopyLink(activeCard, variant)}
      />
    );
  }

  return (
    <RecapScreen
      cards={cards}
      sessionId={sessionId}
      downloadUrl={downloadUrl}
      resolveKey={resolveKey}
      maskNames={maskNames}
      onToggleMask={() => setMaskNames((m) => !m)}
      onReplay={replay}
      onJumpTo={jumpTo}
      onPreview={(card) => {
        setPreviewCard(card);
        setPreviewVariant("story");
      }}
      onDownloadAll={handleDownload}
      onDeleteSession={handleDeleteSession}
      email={email}
      emailSent={emailSent}
      emailMarketingOptIn={emailMarketingOptIn}
      onEmailChange={setEmail}
      onEmailMarketingOptInChange={setEmailMarketingOptIn}
      onEmailSubmit={handleEmailReport}
      previewCard={previewCard}
      previewVariant={previewVariant}
      onPreviewVariantChange={setPreviewVariant}
      onPreviewClose={() => setPreviewCard(null)}
      onPreviewSave={(variant) => previewCard && handleSaveCard(previewCard, variant)}
      onPreviewCopy={(variant) => previewCard && handleCopyLink(previewCard, variant)}
    />
  );
}

// =============================================================================
// Story Player — full-bleed, Wrapped-style playback
// =============================================================================

function StoryPlayer({
  cards,
  currentIndex,
  progress,
  paused,
  downloadUrl,
  resolveKey,
  maskNames,
  onToggleMask,
  onPauseStart,
  onPauseEnd,
  onTogglePause,
  onPrev,
  onNext,
  onExit,
  onSave,
  onCopyLink,
}: {
  cards: CardManifestEntry[];
  currentIndex: number;
  progress: number;
  paused: boolean;
  downloadUrl: (key: string) => string;
  resolveKey: (card: CardManifestEntry, variant: "story" | "poster") => string;
  maskNames: boolean;
  onToggleMask: () => void;
  onPauseStart: () => void;
  onPauseEnd: () => void;
  onTogglePause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  onSave: (variant: "story" | "poster") => void;
  onCopyLink: (variant: "story" | "poster") => void;
}) {
  const card = cards[currentIndex];
  const accent = ACCENT_HEX[card.accent] || ACCENT_HEX.coral;
  const url = downloadUrl(resolveKey(card, "story"));

  // Preload neighbouring cards so the next/prev tap is instant.
  const neighbours = [currentIndex - 1, currentIndex + 1]
    .filter((i) => i >= 0 && i < cards.length)
    .map((i) => downloadUrl(resolveKey(cards[i], "story")));

  return (
    <main className="fixed inset-0 z-30 flex flex-col bg-[#02030a] overflow-hidden touch-none select-none">
      {/* Accent backdrop — large radial that recolours per card */}
      <div
        key={`bg-${card.id}`}
        className="absolute inset-0 -z-10 transition-opacity duration-700"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${accent}33 0%, ${accent}10 35%, transparent 70%), radial-gradient(ellipse 90% 70% at 50% 110%, ${accent}25 0%, transparent 60%)`,
        }}
      />
      <div
        key={`pulse-${card.id}`}
        className="absolute inset-0 -z-10 animate-accent-pulse"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${accent}1f 0%, transparent 50%)`,
        }}
      />

      {/* Hidden preloaders for adjacent cards */}
      {neighbours.map((href) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={href} src={href} alt="" className="hidden" aria-hidden />
      ))}

      {/* Top bar: segmented progress + meta */}
      <header className="relative z-20 px-4 sm:px-8 pt-3 pb-3">
        <ProgressBars total={cards.length} active={currentIndex} progress={progress} />
        <div className="mt-3 flex items-center justify-between text-[11px] font-medium">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
          >
            <span className="relative w-5 h-5 rounded-md bg-gradient-to-br from-coral via-rose to-purple flex items-center justify-center text-white font-bold text-[9px] shadow shadow-coral/30">
              W
            </span>
            Wapi Pesa
          </Link>
          <span className="font-mono tabular-nums text-white/45 tracking-widest">
            {String(currentIndex + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMask}
              aria-pressed={maskNames}
              title={maskNames ? "Names are masked — tap to unmask" : "Mask names for sharing"}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ring-1 transition-colors ${
                maskNames
                  ? "bg-white/20 text-white ring-white/30"
                  : "text-white/55 hover:text-white ring-white/15 hover:bg-white/10"
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58A3 3 0 0012 15a3 3 0 002.42-1.18m4.04-2.32C19.74 12.8 21 14 21 14s-3.5 6-9 6c-1.61 0-3.06-.51-4.31-1.27M6.16 6.16C4.27 7.43 3 9 3 9s3.5 6 9 6c.86 0 1.66-.13 2.39-.36" />
              </svg>
              {maskNames ? "Masked" : "Mask"}
            </button>
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1 text-white/70 hover:text-white transition-colors"
              aria-label="View all cards"
            >
              View all
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Stage */}
      <div className="relative flex-1 flex items-center justify-center px-3 sm:px-8 pb-32 sm:pb-28">
        {/* Tap zones — left=prev, center=pause hold, right=next.
            Pointer events for hold-to-pause work on touch and mouse. */}
        <div className="absolute inset-0 z-10 grid grid-cols-3" aria-hidden>
          <button
            type="button"
            aria-label="Previous card"
            onClick={onPrev}
            onPointerDown={onPauseStart}
            onPointerUp={onPauseEnd}
            onPointerLeave={onPauseEnd}
            onPointerCancel={onPauseEnd}
            className="cursor-w-resize focus:outline-none"
          />
          <button
            type="button"
            aria-label="Pause"
            onClick={onTogglePause}
            onPointerDown={onPauseStart}
            onPointerUp={onPauseEnd}
            onPointerLeave={onPauseEnd}
            onPointerCancel={onPauseEnd}
            className="cursor-pointer focus:outline-none"
          />
          <button
            type="button"
            aria-label="Next card"
            onClick={onNext}
            onPointerDown={onPauseStart}
            onPointerUp={onPauseEnd}
            onPointerLeave={onPauseEnd}
            onPointerCancel={onPauseEnd}
            className="cursor-e-resize focus:outline-none"
          />
        </div>

        {/* Card itself — keyed by card id so React fully remounts and the
            entry animation replays on every advance. */}
        <div
          key={card.id}
          className="relative z-[5] animate-story-in"
          style={{ filter: `drop-shadow(0 30px 80px ${accent}66) drop-shadow(0 0 30px ${accent}33)` }}
        >
          <div className="rounded-3xl overflow-hidden ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={card.headline}
              className="block max-h-[68vh] sm:max-h-[78vh] w-auto h-auto animate-ken-burns"
              draggable={false}
            />
          </div>
        </div>

        {/* Side chevrons — desktop only, more discoverable than tap zones */}
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/8 hover:bg-white/20 backdrop-blur-md ring-1 ring-white/15 items-center justify-center text-white/80 hover:text-white transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/8 hover:bg-white/20 backdrop-blur-md ring-1 ring-white/15 items-center justify-center text-white/80 hover:text-white transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Paused indicator */}
        {paused && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-black/55 backdrop-blur ring-1 ring-white/15 text-[10px] font-semibold tracking-widest uppercase text-white/80">
              Paused
            </div>
          </div>
        )}
      </div>

      {/* Bottom action dock */}
      <footer className="absolute bottom-0 inset-x-0 z-30 px-4 sm:px-6 pt-8 pb-5 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
        <div className="max-w-md mx-auto flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => onSave("story")}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-white text-[#02030a] font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all min-h-[44px] shadow-lg shadow-black/30"
          >
            <DownloadIcon />
            Save
          </button>
          <button
            type="button"
            onClick={() => onCopyLink("story")}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-white/10 text-white font-medium text-sm hover:bg-white/20 ring-1 ring-white/15 active:scale-[0.98] transition-all min-h-[44px] backdrop-blur"
          >
            <ShareIcon />
            Share
          </button>
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={paused ? "Play" : "Pause"}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 ring-1 ring-white/15 backdrop-blur flex items-center justify-center text-white transition-all"
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
        </div>
        <p className="mt-3 text-center text-[10px] text-white/35 tracking-wide hidden sm:block">
          Tap to advance · hold to pause · ← → keys · Esc to view all
        </p>
      </footer>
    </main>
  );
}

// =============================================================================
// Recap Screen — celebratory finale + grid + downloads
// =============================================================================

function RecapScreen({
  cards,
  sessionId,
  downloadUrl,
  resolveKey,
  maskNames,
  onToggleMask,
  onReplay,
  onJumpTo,
  onPreview,
  onDownloadAll,
  onDeleteSession,
  email,
  emailSent,
  emailMarketingOptIn,
  onEmailChange,
  onEmailMarketingOptInChange,
  onEmailSubmit,
  previewCard,
  previewVariant,
  onPreviewVariantChange,
  onPreviewClose,
  onPreviewSave,
  onPreviewCopy,
}: {
  cards: CardManifestEntry[];
  sessionId: string;
  downloadUrl: (key: string) => string;
  resolveKey: (card: CardManifestEntry, variant: "story" | "poster") => string;
  maskNames: boolean;
  onToggleMask: () => void;
  onReplay: () => void;
  onJumpTo: (i: number) => void;
  onPreview: (card: CardManifestEntry) => void;
  onDownloadAll: (type: "pdf" | "csv") => void;
  onDeleteSession: () => void;
  email: string;
  emailSent: boolean;
  emailMarketingOptIn: boolean;
  onEmailChange: (v: string) => void;
  onEmailMarketingOptInChange: (v: boolean) => void;
  onEmailSubmit: () => void;
  previewCard: CardManifestEntry | null;
  previewVariant: "story" | "poster";
  onPreviewVariantChange: (v: "story" | "poster") => void;
  onPreviewClose: () => void;
  onPreviewSave: (v: "story" | "poster") => void;
  onPreviewCopy: (v: "story" | "poster") => void;
}) {
  return (
    <main className="min-h-screen w-full">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-8 pb-20">
        {/* Top nav */}
        <nav className="flex items-center justify-between mb-10">
          <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary text-xs transition-colors">
            <span className="relative w-6 h-6 rounded-md bg-gradient-to-br from-coral via-rose to-purple flex items-center justify-center text-white font-bold text-[10px] shadow shadow-coral/30">
              W
            </span>
            Wapi Pesa
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleMask}
              aria-pressed={maskNames}
              title={maskNames ? "Names are masked" : "Mask names for sharing"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-full ring-1 transition-colors ${
                maskNames
                  ? "bg-coral/15 text-coral ring-coral/30"
                  : "bg-white/[0.04] text-text-muted hover:text-text-primary ring-white/10 hover:ring-white/25"
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58A3 3 0 0012 15a3 3 0 002.42-1.18m4.04-2.32C19.74 12.8 21 14 21 14s-3.5 6-9 6c-1.61 0-3.06-.51-4.31-1.27M6.16 6.16C4.27 7.43 3 9 3 9s3.5 6 9 6c.86 0 1.66-.13 2.39-.36" />
              </svg>
              {maskNames ? "Names masked" : "Show names"}
            </button>
            <span className="text-[11px] font-mono tabular-nums text-text-muted tracking-widest">
              {cards.length} CARDS
            </span>
          </div>
        </nav>

        {/* Hero */}
        <header className="text-center mb-12 animate-fade-in-up">
          <p className="eyebrow mb-3">That&apos;s a wrap</p>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95] mb-4">
            Your year, <span className="text-gradient-coral">decoded</span>.
          </h1>
          <p className="text-text-secondary text-base max-w-md mx-auto">
            {cards.length} cards built from your statement. Replay them, pick favourites, or grab the lot.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              type="button"
              onClick={onReplay}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-br from-coral to-rose text-white font-semibold shadow-lg shadow-coral/30 hover:shadow-coral/50 hover:-translate-y-0.5 active:translate-y-0 transition-all min-h-[44px]"
            >
              <PlayIcon />
              Replay story
            </button>
            <button
              type="button"
              onClick={() => onDownloadAll("pdf")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-text-primary font-medium ring-1 ring-white/10 hover:ring-white/20 transition-all min-h-[44px]"
            >
              <DownloadIcon />
              Download card deck (PDF)
            </button>
          </div>
        </header>

        {/* Card grid */}
        <section className="mb-14 animate-fade-in-up">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">
              All cards
            </h2>
            <p className="text-[11px] text-text-muted">Tap to play · long-press for poster</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 stagger">
            {cards.map((card, i) => (
              <RecapTile
                key={`${card.id}-${maskNames && card.hasName ? "p" : "o"}`}
                card={card}
                sessionId={sessionId}
                resolveKey={resolveKey}
                onPlay={() => onJumpTo(i)}
                onOpen={() => onPreview(card)}
              />
            ))}
          </div>
        </section>

        {/* Secondary actions */}
        <section className="grid sm:grid-cols-2 gap-4 mb-10">
          <div className="rounded-2xl glass p-5">
            <p className="text-sm font-semibold text-text-primary mb-1">Email me the deck</p>
            <p className="text-[11px] text-text-muted mb-3">PDF lands in your inbox in under a minute.</p>
            {emailSent ? (
              <p className="text-green text-sm font-medium inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Sent to {email}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:border-coral/40 focus:ring-2 focus:ring-coral/20 transition-all min-w-0"
                  />
                  <button
                    onClick={onEmailSubmit}
                    disabled={!email}
                    className="bg-coral/15 text-coral border border-coral/25 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-coral/25 transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    Send
                  </button>
                </div>
                {/* Marketing opt-in is intentionally a separate, opt-IN
                    checkbox — sending the PDF should never silently
                    enroll a user into the next-year reminder list. */}
                <label className="flex items-start gap-2 text-[11px] text-text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={emailMarketingOptIn}
                    onChange={(e) => onEmailMarketingOptInChange(e.target.checked)}
                    className="mt-[2px] accent-coral"
                  />
                  <span>
                    Also notify me when next year&apos;s wrap is ready. (We won&apos;t spam — one email a year.)
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="rounded-2xl glass p-5">
            <p className="text-sm font-semibold text-text-primary mb-1">Raw transactions</p>
            <p className="text-[11px] text-text-muted mb-3">Categorised CSV — for nerds and accountants.</p>
            <button
              type="button"
              onClick={() => onDownloadAll("csv")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/10 text-text-primary font-medium text-sm py-2.5 transition-all"
            >
              <DownloadIcon />
              Download CSV
            </button>
          </div>
        </section>

        <footer className="text-center pt-6 border-t border-white/5">
          <button
            onClick={onDeleteSession}
            className="text-text-muted hover:text-rose text-xs transition-colors underline underline-offset-4 decoration-dotted"
          >
            Delete all my session data now
          </button>
          <p className="text-[10px] text-text-faint mt-2.5">
            Expires after 30 minutes of inactivity · No database write by default
          </p>
        </footer>
      </div>

      {previewCard && (
        <CardPreviewModal
          card={previewCard}
          variant={previewVariant}
          onVariantChange={onPreviewVariantChange}
          downloadUrl={downloadUrl}
          onDownload={onPreviewSave}
          onCopyLink={onPreviewCopy}
          onClose={onPreviewClose}
        />
      )}
    </main>
  );
}

function RecapTile({
  card,
  sessionId,
  resolveKey,
  onPlay,
  onOpen,
}: {
  card: CardManifestEntry;
  sessionId: string;
  resolveKey: (card: CardManifestEntry, variant: "story" | "poster") => string;
  onPlay: () => void;
  onOpen: () => void;
}) {
  const accentColor = ACCENT_HEX[card.accent] || ACCENT_HEX.coral;
  const url = `/api/download?sessionId=${sessionId}&type=card&card=${encodeURIComponent(resolveKey(card, "story"))}`;

  // Long-press detection: > 350ms triggers the open-as-poster preview.
  const longPress = useRef<{ timer: number | null; fired: boolean }>({ timer: null, fired: false });
  const onPointerDown = () => {
    longPress.current.fired = false;
    longPress.current.timer = window.setTimeout(() => {
      longPress.current.fired = true;
      onOpen();
    }, 350);
  };
  const onPointerUp = () => {
    if (longPress.current.timer !== null) {
      window.clearTimeout(longPress.current.timer);
      longPress.current.timer = null;
    }
    if (!longPress.current.fired) onPlay();
  };
  const onPointerCancel = () => {
    if (longPress.current.timer !== null) {
      window.clearTimeout(longPress.current.timer);
      longPress.current.timer = null;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerCancel}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay();
        }
      }}
      className="group relative aspect-[9/16] overflow-hidden rounded-2xl ring-1 ring-white/10 hover:ring-2 hover:ring-coral/40 transition-all bg-[#0a0f1c] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      style={{ boxShadow: `0 20px 50px -25px ${accentColor}50` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={card.headline}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
        loading="lazy"
        draggable={false}
      />
      <div className="absolute inset-x-0 top-0 p-2.5 flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-md bg-black/45 ring-1 ring-white/15 text-[9px] uppercase tracking-wider font-semibold"
          style={{ color: accentColor }}
        >
          {CARD_TYPE_LABELS[card.cardType] || card.cardType}
        </span>
        <span className="text-[9px] font-mono text-white/55 bg-black/45 px-1.5 py-0.5 rounded">
          {String(card.index).padStart(2, "0")}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between pointer-events-none">
        <div className="w-9 h-9 rounded-full bg-white/95 text-[#02030a] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-black/40">
          <PlayIcon />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Card preview modal — opened from a long-press in the grid
// =============================================================================

function CardPreviewModal({
  card,
  variant,
  onVariantChange,
  downloadUrl,
  onDownload,
  onCopyLink,
  onClose,
}: {
  card: CardManifestEntry;
  variant: "story" | "poster";
  onVariantChange: (v: "story" | "poster") => void;
  downloadUrl: (key: string) => string;
  onDownload: (variant: "story" | "poster") => void;
  onCopyLink: (variant: "story" | "poster") => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const url = downloadUrl(variant === "story" ? card.storyKey : card.posterKey);

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 animate-fade-in">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-default"
      />
      <div className="relative w-full max-w-2xl max-h-full flex flex-col rounded-3xl glass-strong shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-white/5 flex-shrink-0">
          <div className="min-w-0">
            <p className="eyebrow mb-1">{CARD_TYPE_LABELS[card.cardType] || card.cardType}</p>
            <h3 className="font-[family-name:var(--font-heading)] text-lg sm:text-xl font-bold tracking-tight truncate">
              {card.headline}
            </h3>
            {card.tagline && (
              <p className="text-[11px] text-text-muted mt-1 italic truncate">&ldquo;{card.tagline}&rdquo;</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-white/[0.04] hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/20 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="px-6 pt-4 flex justify-center">
          <div className="inline-flex rounded-full bg-white/[0.04] ring-1 ring-white/10 p-1">
            {(["story", "poster"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onVariantChange(v)}
                className={`px-4 py-1.5 text-[11px] font-medium rounded-full transition-colors ${
                  variant === v ? "bg-coral text-white" : "text-text-muted hover:text-text-primary"
                }`}
              >
                {v === "story" ? "Story · 9:16" : "Poster · 16:9"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex flex-col items-center gap-3">
          <div
            className="rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/60 bg-[#0a0f1c]"
            style={{ width: "100%", maxWidth: variant === "story" ? 360 : 540 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={card.headline} className="block w-full h-auto" />
          </div>
          <p className="text-[10px] text-text-faint">
            {variant === "story" ? "1080 × 1920 PNG" : "1200 × 675 PNG"}
          </p>
        </div>

        <footer className="px-6 py-4 border-t border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onDownload(variant)}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-br from-coral to-rose text-white font-semibold py-3 rounded-xl shadow-lg shadow-coral/30 hover:shadow-coral/50 transition-all min-h-[44px]"
          >
            <DownloadIcon />
            Save {variant === "story" ? "story" : "poster"}
          </button>
          <button
            type="button"
            onClick={() => onCopyLink(variant)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 text-text-primary font-medium py-3 hover:bg-white/[0.04] transition-all min-h-[44px]"
          >
            <ShareIcon />
            Copy link
          </button>
        </footer>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components & icons
// =============================================================================

function ProgressBars({ total, active, progress }: { total: number; active: number; progress: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => {
        const fill = i < active ? 1 : i === active ? progress : 0;
        return (
          <div key={i} className="flex-1 h-[3px] rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{
                width: `${fill * 100}%`,
                transition: i === active ? "width 100ms linear" : "width 200ms ease-out",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 min-h-screen">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-white/5" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-coral animate-spin-slow" />
          <div
            className="absolute inset-3 rounded-full border-2 border-transparent border-t-purple animate-spin-slow"
            style={{ animationDirection: "reverse", animationDuration: "2.4s" }}
          />
        </div>
        <p className="eyebrow mb-3">Building your wrap</p>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          <span className="text-gradient-coral">Wrapping</span> your year
        </h1>
        <p className="text-text-secondary text-sm">Painting your cards. About 10–30 seconds.</p>
      </div>
    </main>
  );
}

function ErrorScreen() {
  return (
    <main className="flex-1 flex items-center justify-center min-h-screen px-6">
      <div className="text-center max-w-sm">
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold mb-2">Something broke</h2>
        <p className="text-text-secondary text-sm">Couldn&apos;t load your report. Try refreshing.</p>
      </div>
    </main>
  );
}

function DeletedScreen() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 min-h-screen">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-green/10 ring-1 ring-green/30 flex items-center justify-center">
          <svg className="w-7 h-7 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight mb-2">Session deleted</h1>
        <p className="text-text-secondary text-sm">All data from this session has been permanently erased.</p>
      </div>
    </main>
  );
}

function EmptyScreen({ sessionId }: { sessionId: string }) {
  return (
    <main className="flex-1 flex items-center justify-center min-h-screen px-6">
      <div className="text-center max-w-sm">
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold mb-2">No cards yet</h2>
        <p className="text-text-secondary text-sm mb-4">
          Your statement didn&apos;t produce any share cards. Try the dashboard for the full breakdown.
        </p>
        <Link
          href={`/dashboard?sessionId=${sessionId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-coral/15 text-coral border border-coral/25 text-sm font-semibold hover:bg-coral/25 transition-colors"
        >
          Open dashboard
        </Link>
      </div>
    </main>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10.001-5.367 3 3 0 000 5.367zm-9.032 0a3 3 0 10.001-5.367 3 3 0 000 5.367z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
