"use client";

import Link from "next/link";
import { SHOWCASE_PREVIEW } from "@/lib/showcase-preview";

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      {/* ============ HEADER ============ */}
      <Header />

      {/* ============ HERO ============ */}
      <Hero />

      {/* ============ HOW IT WORKS ============ */}
      <HowItWorks />

      {/* ============ TWO MODES ============ */}
      <TwoModes />

      {/* ============ SAMPLE PREVIEW ============ */}
      <SamplePreview />

      {/* ============ PRIVACY ============ */}
      <Privacy />

      {/* ============ PRICING ============ */}
      <Pricing />

      {/* ============ FAQ ============ */}
      <Faq />

      {/* ============ FOOTER ============ */}
      <Footer />
    </main>
  );
}

// =============================================================================
// HEADER
// =============================================================================

function Header() {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-bg/60 border-b border-white/5">
      <div className="max-w-screen-xl mx-auto w-full px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-coral via-rose to-purple flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-coral/30 group-hover:shadow-coral/50 transition-shadow">
            W
          </div>
          <span className="font-[family-name:var(--font-heading)] font-semibold tracking-tight text-[15px]">
            Wapi Pesa
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-1 text-xs">
          <NavLink href="#how">How it works</NavLink>
          <NavLink href="#pricing">Product concept</NavLink>
          <NavLink href="/privacy">Privacy</NavLink>
          <NavLink href="#sample">Sample report</NavLink>
        </div>
        <Link
          href="/upload"
          className="px-4 py-2 rounded-full bg-gradient-to-r from-coral to-rose text-white text-xs font-medium hover:from-coral/90 hover:to-rose/90 transition-all shadow-md shadow-coral/20"
        >
          View showcase
        </Link>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-text-secondary hover:text-text-primary transition-colors"
    >
      {children}
    </Link>
  );
}

// =============================================================================
// HERO
// =============================================================================

function Hero() {
  return (
    <section className="relative px-5 sm:px-8 pt-12 sm:pt-20 pb-20 sm:pb-28 max-w-screen-xl mx-auto w-full">
      <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        {/* Headline */}
        <div className="lg:col-span-7 stagger">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-7 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green opacity-75 animate-pulse-slow" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green" />
            </span>
            <span className="text-[11px] tracking-wide text-text-secondary">
              Public showcase · Uploads off · Payments off
            </span>
          </div>

          <h1 className="font-[family-name:var(--font-heading)] font-bold tracking-tight leading-[0.92] text-[3rem] sm:text-7xl lg:text-[5.5rem] xl:text-[6.5rem] 2xl:text-[7.25rem] mb-6">
            <span className="text-gradient-soft">Where did the </span>
            <span className="text-gradient-coral">money</span>
            <span className="text-gradient-soft"> go?</span>
          </h1>

          <p className="text-xl sm:text-2xl text-text-primary font-medium mb-5 max-w-2xl">
            A technical showcase for understanding personal M-Pesa activity.
          </p>

          <p className="text-base sm:text-lg text-text-secondary mb-9 max-w-2xl leading-relaxed">
            The prototype turns a personal M-Pesa Pay statement into a report
            you can actually read. This public deployment uses synthetic data
            and does not accept financial documents.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-7">
            <Link
              href="/upload"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-coral to-rose text-white font-medium shadow-lg shadow-coral/30 hover:shadow-coral/50 hover:scale-[1.02] active:scale-[0.99] transition-all"
            >
              Explore the showcase
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <Link
              href="#sample"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/15 text-text-primary hover:bg-white/5 hover:border-white/25 transition-all"
            >
              See a sample report
            </Link>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-muted">
            <span>Public preview accepts no files</span>
            <span aria-hidden>·</span>
            <span>Synthetic sample data</span>
            <span aria-hidden>·</span>
            <span>Payments disabled</span>
          </div>
        </div>

        {/* Tilted preview-card stack */}
        <div className="lg:col-span-5 hidden md:block">
          <div className="relative h-[440px]">
            <div className="absolute inset-0 -translate-x-3 translate-y-3 rotate-[-3deg] glass rounded-3xl opacity-50" />
            <div className="absolute inset-0 translate-x-3 -translate-y-2 rotate-[2deg] glass-strong rounded-3xl opacity-70" />
            <div className="absolute inset-0 glass-strong rounded-3xl p-6 flex flex-col">
              <div className="text-[10px] eyebrow mb-3">
                Preview · {SHOWCASE_PREVIEW.periodLabel}
              </div>
              <div className="num-display text-4xl text-gradient-coral mb-1">
                KES {(SHOWCASE_PREVIEW.totalMoved / 1_000).toFixed(1)}K
              </div>
              <div className="text-xs text-text-muted mb-6">moved through the account</div>
              <div className="space-y-3 flex-1">
                {SHOWCASE_PREVIEW.categories.map((category) => (
                  <PreviewRow
                    key={category.label}
                    label={category.label}
                    pct={category.percentage}
                    accent={category.accent}
                  />
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-white/10 text-[11px] text-text-muted">
                <span className="text-text-secondary">
                  {SHOWCASE_PREVIEW.transactionCount} synthetic transactions
                </span>{" "}
                · {SHOWCASE_PREVIEW.categories.length} categories ·{" "}
                {SHOWCASE_PREVIEW.selfTransferCount} self-transfer
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewRow({ label, pct, accent }: { label: string; pct: number; accent: string }) {
  const accentMap: Record<string, string> = {
    coral: "from-coral to-rose",
    purple: "from-purple to-rose",
    cyan: "from-cyan to-purple",
    green: "from-green to-cyan",
    rose: "from-rose to-purple",
  };
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1.5">
        <span className="text-text-secondary">{label}</span>
        <span className="num-display text-text-primary">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${accentMap[accent] ?? "from-coral to-rose"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// HOW IT WORKS
// =============================================================================

function HowItWorks() {
  return (
    <section
      id="how"
      className="px-5 sm:px-8 py-20 sm:py-28 max-w-screen-xl mx-auto w-full"
    >
      <div className="text-center mb-14 sm:mb-20">
        <div className="eyebrow mb-4">How it works</div>
        <h2 className="font-[family-name:var(--font-heading)] font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl text-gradient-soft">
          A deliberate three-stage pipeline.
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-5 sm:gap-7">
        <Step
          n="01"
          title="Accept a personal statement"
          body="In an enabled private deployment, the parser accepts personal M-Pesa Pay statement PDFs. The public showcase blocks uploads."
        />
        <Step
          n="02"
          title="Parse it on the server"
          body="The file is uploaded to the application server, parsed in process memory, and never intentionally persisted by the application."
        />
        <Step
          n="03"
          title="Generate the report"
          body="The prototype produces categorized analytics and exports from a process-local session with a 30-minute inactivity limit."
        />
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-7 hover:border-white/15 transition-colors">
      <div className="num-display text-2xl text-gradient-coral mb-4">{n}</div>
      <h3 className="font-[family-name:var(--font-heading)] font-semibold text-xl mb-2.5 text-text-primary">
        {title}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

// =============================================================================
// TWO MODES
// =============================================================================

function TwoModes() {
  return (
    <section className="px-5 sm:px-8 py-20 sm:py-28 max-w-screen-xl mx-auto w-full">
      <div className="text-center mb-14 sm:mb-20">
        <div className="eyebrow mb-4">Pick your lens</div>
        <h2 className="font-[family-name:var(--font-heading)] font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl mb-4">
          <span className="text-gradient-soft">Two reports. Same data. </span>
          <span className="text-gradient-coral">Different temperatures.</span>
        </h2>
        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto">
          One is visual and playful; one is analytical. Checkout is disabled in this showcase.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 sm:gap-7">
        <ModeCard
          label="REFLECT"
          price="Concept · KES 300"
          accent="coral"
          heading="Your year as a story."
          body="Ten share-ready cards. The number you spent at Java. The night you sent the most money. The friend who got the biggest send. Designed for screenshots, written with a sense of humor, mildly uncomfortable about your Uber habit."
          features={[
            "10 designed share cards",
            "Instagram Story + Twitter formats",
            "A printable PDF version",
            "Personalized punchline written for your data",
          ]}
        />
        <ModeCard
          label="UNDERSTAND"
          price="Concept · from KES 800"
          accent="green"
          heading="Your year, audited."
          body="The serious version. Every paybill translated into plain English. Every recurring charge surfaced. Every loan, every fee, every leak. Built for people preparing for a loan application, reconciling business expenses, or just tired of not knowing where the money went."
          features={[
            "Full paybill glossary",
            "Recurring payment audit",
            "Mobile loan and Fuliza breakdown",
            "Categorized CSV export",
            "Household staff payment summary",
          ]}
        />
      </div>
    </section>
  );
}

function ModeCard({
  label,
  price,
  accent,
  heading,
  body,
  features,
}: {
  label: string;
  price: string;
  accent: "coral" | "green";
  heading: string;
  body: string;
  features: string[];
}) {
  const isCoral = accent === "coral";
  return (
    <div
      className={`glass-strong rounded-3xl p-7 sm:p-9 relative overflow-hidden ${
        isCoral ? "" : "lg:translate-y-6"
      }`}
    >
      {/* Glow halo */}
      <div
        aria-hidden
        className={`absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-20 ${
          isCoral ? "bg-coral" : "bg-green"
        }`}
      />
      <div className="relative">
        <div className="flex items-baseline justify-between gap-3 mb-7 flex-wrap">
          <span
            className={`text-[11px] eyebrow ${
              isCoral ? "text-coral" : "text-green"
            }`}
          >
            {label}
          </span>
          <span className="num-display text-base text-text-secondary">{price}</span>
        </div>

        <h3 className="font-[family-name:var(--font-heading)] font-bold tracking-tight text-3xl sm:text-4xl mb-5 text-text-primary">
          {heading}
        </h3>

        <p className="text-text-secondary text-base sm:text-lg leading-relaxed mb-8">
          {body}
        </p>

        <ul className="space-y-3 mb-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-sm">
              <span
                className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                  isCoral ? "bg-coral" : "bg-green"
                }`}
              />
              <span className="text-text-primary">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// =============================================================================
// SAMPLE PREVIEW
// =============================================================================

function SamplePreview() {
  return (
    <section
      id="sample"
      className="px-5 sm:px-8 py-20 sm:py-28 max-w-screen-xl mx-auto w-full"
    >
      <div className="text-center mb-14">
        <h2 className="font-[family-name:var(--font-heading)] font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl mb-4 text-gradient-soft">
          This is what you get back.
        </h2>
        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto">
          Every name, identifier, date, and amount shown here is synthetic.
        </p>
      </div>

      <Link
        href="/upload"
        className="block group max-w-3xl mx-auto"
        aria-label="Open public showcase status"
      >
        <div className="relative glass-strong rounded-3xl overflow-hidden group-hover:border-white/20 transition-colors">
          {/* Deliberately synthetic sample mock. */}
          <div className="aspect-[3/4] sm:aspect-[4/3] flex flex-col">
            <div className="px-7 sm:px-10 py-7 sm:py-10 flex-1 flex flex-col gap-7">
              <div>
                <div className="eyebrow mb-3">Synthetic fixture · January – March 2026</div>
                <div className="num-display text-5xl sm:text-6xl text-gradient-coral mb-2">
                  KES {(SHOWCASE_PREVIEW.totalMoved / 1_000).toFixed(1)}K
                </div>
                <div className="text-text-secondary text-sm">
                  Money moved across {SHOWCASE_PREVIEW.transactionCount} invented transactions
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Tile label="Top recipient" value="AMANI SAMPLE" sub="KES 90K · 3 sends" />
                <Tile label="Top merchant" value="SAMPLE MARKET" sub="KES 18K · 3 visits" />
                <Tile label="Quietest month" value="February 2026" sub="4 transactions" />
                <Tile label="Late-night spending" value="0%" sub="Synthetic fixture" />
              </div>

              <div className="mt-auto pt-5 border-t border-white/10 flex items-center justify-between text-[11px] text-text-muted">
                <span>Synthetic data only. Uploads remain disabled.</span>
                <span className="group-hover:text-text-primary transition-colors">
                  Preview status →
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="eyebrow mb-2">{label}</div>
      <div className="num-display text-text-primary text-base mb-0.5 truncate">{value}</div>
      <div className="text-[11px] text-text-muted">{sub}</div>
    </div>
  );
}

// =============================================================================
// PRIVACY
// =============================================================================

function Privacy() {
  return (
    <section className="px-5 sm:px-8 py-20 sm:py-28 max-w-screen-xl mx-auto w-full">
      <div className="text-center mb-14">
        <div className="eyebrow mb-4">Privacy by design</div>
        <h2 className="font-[family-name:var(--font-heading)] font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl text-gradient-soft">
          The public showcase keeps financial data out.
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-5 sm:gap-7 mb-10">
        <PrivacyPoint
          n="01"
          title="Server-side, not browser-only"
          body="When explicitly enabled, the browser uploads the PDF to the app server. The application parses it in process memory and does not intentionally persist the file to disk or a database."
        />
        <PrivacyPoint
          n="02"
          title="30-minute inactivity limit"
          body="Process-local session data expires after thirty minutes without access and may disappear sooner if the process restarts. It can also be deleted explicitly."
        />
        <PrivacyPoint
          n="03"
          title="External paths fail closed"
          body="Uploads, payments, email delivery, and benchmark database writes all default to off. No third-party analytics SDK is included on the sensitive screens."
        />
      </div>

      <p className="text-center text-sm text-text-muted max-w-3xl mx-auto">
        Wapi Pesa is not affiliated with Safaricom or M-Pesa. We just read the
        PDFs they send you.
      </p>
    </section>
  );
}

function PrivacyPoint({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-7">
      <div className="num-display text-xl text-text-secondary mb-4">{n}</div>
      <h3 className="font-[family-name:var(--font-heading)] font-semibold text-lg mb-2.5 text-text-primary">
        {title}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

// =============================================================================
// PRICING
// =============================================================================

function Pricing() {
  return (
    <section
      id="pricing"
      className="px-5 sm:px-8 py-20 sm:py-28 max-w-screen-xl mx-auto w-full"
    >
      <div className="text-center mb-14">
        <div className="eyebrow mb-4">Pricing</div>
        <h2 className="font-[family-name:var(--font-heading)] font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl text-gradient-soft">
          Planned pricing. Checkout is disabled.
        </h2>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 sm:gap-7">
        <PriceCard
          name="Reflect"
          price="Concept · KES 300"
          accent="coral"
          features={[
            "One-time payment",
            "10 share cards + PDF report",
          ]}
          forText="anyone who liked Spotify Wrapped"
        />
        <PriceCard
          name="Understand"
          price="Concept · KES 800"
          subprice="single month"
          alt="KES 2,000 · annual"
          accent="green"
          features={[
            "One-time payment per report",
            "Full analytical breakdown",
            "CSV export included",
          ]}
          forText="loan applications, business reconciliation, serious budgeters"
        />
        <PriceCard
          name="Both"
          price="Concept · KES 2,200"
          accent="purple"
          highlighted
          features={[
            "Save KES 100",
            "The full picture, both lenses",
          ]}
          forText="people who want the laugh and the audit"
        />
      </div>

      <p className="text-center text-xs text-text-muted mt-10 max-w-2xl mx-auto">
        Daraja and Stripe integrations remain server-gated and unavailable in the public showcase.
      </p>
    </section>
  );
}

function PriceCard({
  name,
  price,
  subprice,
  alt,
  features,
  forText,
  accent,
  highlighted = false,
}: {
  name: string;
  price: string;
  subprice?: string;
  alt?: string;
  features: string[];
  forText: string;
  accent: "coral" | "green" | "purple";
  highlighted?: boolean;
}) {
  const accentClass =
    accent === "coral" ? "text-coral" : accent === "green" ? "text-green" : "text-purple";

  return (
    <div
      className={`glass-strong rounded-2xl p-7 relative overflow-hidden ${
        highlighted ? "border-purple/40 ring-1 ring-purple/20" : ""
      }`}
    >
      {highlighted && (
        <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-purple/20 text-purple text-[10px] font-medium">
          Best value
        </div>
      )}
      <div className={`eyebrow mb-3 ${accentClass}`}>{name}</div>
      <div className="num-display text-4xl text-text-primary mb-1">{price}</div>
      {subprice && (
        <div className="text-xs text-text-muted mb-1">({subprice})</div>
      )}
      {alt && <div className="text-xs text-text-secondary mb-1">or {alt}</div>}
      <div className="my-5 h-px bg-white/10" />
      <ul className="space-y-2.5 mb-5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-text-primary">
            <span
              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                accent === "coral" ? "bg-coral" : accent === "green" ? "bg-green" : "bg-purple"
              }`}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">For: {forText}</p>
    </div>
  );
}

// =============================================================================
// FAQ
// =============================================================================

function Faq() {
  const items = [
    {
      q: "How do I get my M-Pesa statement?",
      a: "Request a personal M-Pesa Pay statement through Safaricom's supported channels and use the statement password or PIN Safaricom provides. Do not upload a real statement to this public showcase; uploads are disabled.",
    },
    {
      q: "Is this safe?",
      a: "The public showcase does not accept statements. In an enabled private deployment, the file reaches the app server and parsed data lives in a process-local session for up to 30 minutes of inactivity. Read the privacy page before enabling that path.",
    },
    {
      q: "What if my statement has weird transactions you don't recognize?",
      a: "We classify what we can with high confidence and leave the rest as \"Uncategorized\" — usually under 10% of transactions. You can manually recategorize anything in the report.",
    },
    {
      q: "Does this work for business M-Pesa accounts?",
      a: "It works for personal M-Pesa Pay statements. Business till and paybill accounts have different statement formats — we're working on those next.",
    },
    {
      q: "Can I pay for a report here?",
      a: "No. Checkout and payment API routes are disabled in this public showcase. The repository contains gated integration code for controlled development.",
    },
    {
      q: "Can I use this for a loan application?",
      a: "The Understand report includes a categorized CSV and a clean PDF formatted for sharing with banks, microlenders, or visa applications.",
    },
    {
      q: "Why does this exist?",
      a: "Because nobody knows where their M-Pesa money goes, and Safaricom has no incentive to tell you. We thought someone should.",
    },
  ];

  return (
    <section id="faq" className="px-5 sm:px-8 py-20 sm:py-28 max-w-screen-xl mx-auto w-full">
      <div className="text-center mb-14">
        <h2 className="font-[family-name:var(--font-heading)] font-bold tracking-tight text-4xl sm:text-5xl lg:text-6xl text-gradient-soft">
          Things people ask before uploading.
        </h2>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {items.map((item, i) => (
          <FaqItem key={i} q={item.q} a={item.a} />
        ))}
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group glass rounded-2xl">
      <summary className="cursor-pointer list-none px-6 py-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors rounded-2xl">
        <span className="font-medium text-text-primary text-base sm:text-lg">{q}</span>
        <span
          aria-hidden
          className="text-text-secondary text-xl shrink-0 transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="px-6 pb-6 -mt-1 text-text-secondary leading-relaxed text-sm sm:text-base">
        {a}
      </div>
    </details>
  );
}

// =============================================================================
// FOOTER
// =============================================================================

function Footer() {
  return (
    <footer className="border-t border-white/5 mt-10">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 py-10 grid md:grid-cols-3 gap-7 text-sm">
        <div className="text-text-muted leading-relaxed">
          <div className="font-[family-name:var(--font-heading)] font-semibold text-text-primary mb-1">
            Wapi Pesa
          </div>
          Where the money went.
          <br />
          <span className="text-xs">
            Not affiliated with Safaricom or M-Pesa.
          </span>
        </div>
        <nav className="flex flex-wrap items-start justify-start md:justify-center gap-x-4 gap-y-2 text-text-secondary">
          <Link href="#how" className="hover:text-text-primary transition-colors">
            How it works
          </Link>
          <Link href="#sample" className="hover:text-text-primary transition-colors">
            Sample report
          </Link>
          <Link href="#pricing" className="hover:text-text-primary transition-colors">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-text-primary transition-colors">
            Privacy
          </Link>
          <Link href="#faq" className="hover:text-text-primary transition-colors">
            FAQ
          </Link>
          <a
            href="mailto:hello@wapipesa.co.ke"
            className="hover:text-text-primary transition-colors"
          >
            Contact
          </a>
        </nav>
        <div className="text-text-muted text-right md:text-right leading-relaxed">
          Built in Nairobi.
          <br />
          <a
            href="mailto:hello@wapipesa.co.ke"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            hello@wapipesa.co.ke
          </a>
        </div>
      </div>
    </footer>
  );
}
