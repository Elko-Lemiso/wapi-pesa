"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CLIENT_PAYMENTS_ENABLED } from "@/lib/client-features";
import { getKesPrice } from "@/lib/pricing";

export default function PaymentPage() {
  if (!CLIENT_PAYMENTS_ENABLED) {
    return <PaymentPreviewNotice />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin-slow w-8 h-8 border-2 border-coral/20 border-t-coral rounded-full" />
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}

function PaymentPreviewNotice() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-3xl glass-strong p-8 sm:p-12 text-center">
        <p className="eyebrow mb-4">Public showcase</p>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-5">
          Checkout is disabled.
        </h1>
        <p className="text-text-secondary leading-relaxed max-w-md mx-auto mb-8">
          This deployment cannot start an M-Pesa or card charge. The payment integrations remain behind a server-side feature flag for controlled development only.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/#sample"
            className="px-5 py-3 rounded-full bg-gradient-to-r from-coral to-rose text-white text-sm font-semibold"
          >
            View synthetic sample
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

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const mode = searchParams.get("mode") || "reflect";
  const period = searchParams.get("period") || "annual";

  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "card">("mpesa");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "polling" | "confirmed" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const amount = getKesPrice(
    mode === "understand" ? "understand" : "reflect",
    period === "single_month" ? "single_month" : "annual"
  );

  useEffect(() => {
    if (status !== "polling" || !sessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pay/mpesa/status?sessionId=${sessionId}`);
        const data = await res.json();

        if (data.status === "payment_confirmed") {
          setStatus("confirmed");
          clearInterval(interval);
          if (mode === "reflect") {
            const generateResponse = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            });
            if (!generateResponse.ok) {
              setStatus("failed");
              setError("Payment succeeded, but report generation needs to be retried.");
              return;
            }
            router.push(`/report?sessionId=${sessionId}`);
          } else {
            router.push(`/dashboard?sessionId=${sessionId}`);
          }
        } else if (data.status === "parsed") {
          setStatus("failed");
          setError("Payment was not completed. Please try again.");
          clearInterval(interval);
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, sessionId, mode, router]);

  const handleMpesaPay = async () => {
    if (!phoneNumber || !sessionId) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/pay/mpesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, phoneNumber }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus("polling");
      } else {
        setError(data.error || "Failed to initiate payment");
        setStatus("failed");
      }
    } catch {
      setError("Payment failed. Please try again.");
      setStatus("failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardPay = async () => {
    if (!sessionId) return;

    setIsProcessing(true);
    try {
      const res = await fetch("/api/pay/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Failed to create checkout session");
      }
    } catch {
      setError("Payment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!sessionId) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-text-muted">Invalid session. Please start over.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      <nav className="px-6 lg:px-10 pt-6 max-w-2xl mx-auto w-full">
        <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-secondary text-sm transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <p className="eyebrow mb-3">Checkout</p>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Complete <span className="text-gradient-coral">payment</span>
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.025]">
              <span className={`w-1.5 h-1.5 rounded-full ${mode === "reflect" ? "bg-coral" : "bg-green"}`} />
              <span className="text-xs text-text-secondary">
                {mode === "reflect" ? "Reflect" : "Understand"} report
              </span>
              <span className="text-text-faint">·</span>
              <span className="text-xs font-bold text-text-primary font-mono">KES {amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 rounded-2xl glass p-1 mb-6 relative">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ${
                paymentMethod === "mpesa" ? "left-1 bg-green/15 ring-1 ring-green/25" : "left-[calc(50%+0px)] bg-purple/15 ring-1 ring-purple/25"
              }`}
            />
            <button
              onClick={() => setPaymentMethod("mpesa")}
              className={`relative py-3 rounded-xl text-sm font-semibold transition-colors ${
                paymentMethod === "mpesa" ? "text-green" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              M-Pesa
            </button>
            <button
              onClick={() => setPaymentMethod("card")}
              className={`relative py-3 rounded-xl text-sm font-semibold transition-colors ${
                paymentMethod === "card" ? "text-purple" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Card
            </button>
          </div>

          {paymentMethod === "mpesa" ? (
            <div className="space-y-4">
              {status === "polling" ? (
                <div className="rounded-3xl glass p-10 text-center">
                  <div className="animate-spin-slow w-12 h-12 border-2 border-green/20 border-t-green rounded-full mx-auto mb-5" />
                  <p className="text-text-primary font-semibold">Check your phone</p>
                  <p className="text-text-muted text-sm mt-1.5">
                    Enter your M-Pesa PIN to complete the payment.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl glass p-5">
                    <label htmlFor="phone" className="block text-sm font-medium text-text-primary mb-1.5">
                      M-Pesa phone number
                    </label>
                    <p className="text-xs text-text-muted mb-3">
                      We&apos;ll push an STK prompt to this number.
                    </p>
                    <input
                      id="phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0712345678"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3.5 text-text-primary placeholder:text-text-faint focus:outline-none focus:border-green/40 focus:ring-2 focus:ring-green/20 transition-all font-mono tracking-wider"
                    />
                  </div>

                  <button
                    onClick={handleMpesaPay}
                    disabled={!phoneNumber || isProcessing}
                    className="w-full bg-gradient-to-br from-green to-emerald-500 text-navy font-semibold py-4 rounded-2xl shadow-lg shadow-green/30 hover:shadow-green/50 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none"
                  >
                    {isProcessing ? "Sending..." : `Pay KES ${amount.toLocaleString()} via M-Pesa`}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl glass p-5">
                <p className="text-text-secondary text-sm">
                  You&apos;ll be redirected to Stripe for secure card payment.
                </p>
              </div>
              <button
                onClick={handleCardPay}
                disabled={isProcessing}
                className="w-full bg-gradient-to-br from-purple to-violet-600 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-purple/30 hover:shadow-purple/50 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none"
              >
                {isProcessing ? "Redirecting..." : "Pay with Card"}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
              {error}
            </div>
          )}

          <p className="text-xs text-text-muted text-center mt-6">
            One-time payment · No subscriptions · No recurring charges
          </p>
        </div>
      </div>
    </main>
  );
}
