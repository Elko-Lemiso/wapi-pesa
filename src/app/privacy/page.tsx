import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-secondary text-sm transition-colors mb-10">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Home
        </Link>

        <p className="eyebrow mb-3">Plain language</p>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl font-bold tracking-tight mb-6">
          Privacy <span className="text-gradient-coral">notes</span>
        </h1>

        <p className="text-text-secondary text-base leading-relaxed mb-12 max-w-2xl">
          The current public showcase does not accept statements, initiate payments, send reports by email,
          or write benchmark data. The details below describe what the checked-in code does if a deployment
          operator explicitly enables those features.
        </p>

        <PolicySection title="Statement processing">
          <PolicyItem heading="Your personal M-Pesa Pay statement PDF">
            The browser uploads the file to a Next.js route on the application server. The application reads it
            into a server-side buffer, decrypts and parses it in process memory, and does not intentionally write
            the PDF to disk or a database. The application zeroes its PDF buffer after text extraction.
          </PolicyItem>
          <PolicyItem heading="Your statement password or PIN">
            The password is sent to the application server with the PDF and used by the PDF parser. The application
            does not intentionally log or persist it. JavaScript strings cannot be securely zeroed; the value becomes
            eligible for garbage collection after the request completes.
          </PolicyItem>
          <PolicyItem heading="Parsed transactions and analytics">
            Full parsed transactions and computed analytics live temporarily in a process-local memory map so the
            report screens and exports can work. They are not shared between server instances and disappear if the
            process restarts. Raw parsed transactions are cleared after report generation; generated outputs and
            analytics remain until the session is deleted or expires.
          </PolicyItem>
        </PolicySection>

        <PolicySection title="Session lifecycle">
          <ol className="space-y-3 text-text-secondary text-sm">
            {[
              "An enabled deployment receives the PDF and optional password in an HTTP request.",
              "The application decrypts, parses, verifies, and analyzes the statement in server process memory.",
              "The application zeroes its PDF buffer after extraction and keeps parsed data in a process-local session.",
              "Each session access refreshes its inactivity timer.",
              "The user can request immediate session deletion from the report interface.",
              "Otherwise, the session is removed after 30 minutes of inactivity and may disappear sooner on a process restart.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-[10px] font-mono text-text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </PolicySection>

        <PolicySection title="Optional external services">
          <PolicyItem heading="Safaricom Daraja and Stripe">
            Payment routes are disabled by default. If enabled, Daraja receives the payer&apos;s phone number,
            amount, and payment reference; Stripe receives the checkout information needed to process a card payment.
          </PolicyItem>
          <PolicyItem heading="Resend">
            Email delivery is disabled by default. If enabled and requested, Resend receives the destination email
            address and generated report attachments, including a categorized CSV when one exists.
          </PolicyItem>
          <PolicyItem heading="Neon/Postgres">
            Benchmark contribution is disabled by default. If explicitly enabled and called, the endpoint stores
            aggregate amounts, category percentages, transaction counts, and derived counts without a direct user ID.
            It does not store raw transaction rows, but aggregate financial values are still sensitive.
          </PolicyItem>
          <PolicyItem heading="OpenRouter">
            OpenRouter prompt helpers are not connected to the current generation route. If an operator connects
            them, aggregate totals and generic recipient labels leave the server. The Reflect prompt builder omits
            contact names, phone fragments, and statement text.
          </PolicyItem>
          <PolicyItem heading="Hosting provider">
            The hosting provider carries the HTTP request and runs the server process. Platform-level buffering,
            network logs, and request metadata are outside this application&apos;s direct control and must be reviewed
            for the chosen deployment environment.
          </PolicyItem>
        </PolicySection>

        <PolicySection title="Scope and limits">
          <BulletList
            items={[
              "Only personal M-Pesa Pay statements are supported; Till and Paybill business statements are not.",
              "The current in-memory session map is a single-process reference implementation, not a multi-instance production store.",
              "No third-party analytics SDK is included on the upload or processing pages.",
              "No user-account system is included.",
              "A deployment operator is responsible for transport security, infrastructure logging, access controls, retention, and regulatory review.",
            ]}
          />
        </PolicySection>

        <PolicySection title="Public showcase guarantees">
          <BulletList
            items={[
              "Statement processing fails closed unless its server flag is exactly true.",
              "Payment, email, and benchmark-write routes each have a separate fail-closed server flag.",
              "The public sample fixture contains invented names, identifiers, dates, and amounts.",
              "Real statements and extracted statement text are excluded from the intended public snapshot.",
            ]}
          />
        </PolicySection>

        <PolicySection title="Security reports">
          <p className="text-text-secondary text-sm leading-relaxed">
            Use the repository&apos;s private vulnerability reporting channel. Never attach a real statement,
            password, phone number, transaction record, credential, or generated report to a public issue.
          </p>
        </PolicySection>

        <p className="text-text-muted text-xs mt-16 pt-8 border-t border-white/5">
          Last updated: September 2026
        </p>
      </div>
    </main>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight mb-5 text-text-primary">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function PolicyItem({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl glass p-5">
      <p className="font-semibold text-text-primary text-sm mb-1.5">{heading}</p>
      <p className="text-text-secondary text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-text-secondary text-sm">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 leading-relaxed">
          <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-text-faint" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
