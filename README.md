# Wapi Pesa

Wapi Pesa is a privacy-conscious technical showcase for turning a personal M-Pesa Pay statement into searchable analytics, a categorized export, and shareable recap cards.

> **Public showcase status:** statement uploads, payments, email delivery, and benchmark writes are disabled by default. The checked-in sample is entirely synthetic. Do not enable document processing on a public deployment without completing the production work listed below.

## What this repository demonstrates

- Password-protected PDF text extraction with `pdfjs-dist`
- Receipt-aware transaction parsing and reconciliation
- Pure TypeScript analytics for categories, recurring payments, fees, loans, counterparties, and time patterns
- Share-card rendering with Satori and Sharp
- PDF report generation with `@react-pdf/renderer`
- Explicit, fail-closed runtime flags around sensitive and external operations

## Supported statement format

The parser supports **personal M-Pesa Pay statement PDFs only**. It does not support M-Pesa Till, Paybill, or other business-account statement formats.

## Safe default configuration

Copy the example environment file and start the app:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With the example configuration, the app remains a non-uploading showcase and no payment or persistence integration is active.

The sensitive paths fail closed unless their exact server-side flag is set to `true`:

| Capability | Server flag | Public UI flag | Default |
| --- | --- | --- | --- |
| Statement upload and parsing | `STATEMENT_PROCESSING_ENABLED` | Server capability response | Off |
| M-Pesa and Stripe checkout | `PAYMENTS_ENABLED` | `NEXT_PUBLIC_PAYMENTS_ENABLED` | Off |
| Aggregate benchmark writes | `BENCHMARK_CONTRIBUTION_ENABLED` | — | Off |
| Report email delivery | `EMAIL_DELIVERY_ENABLED` | — | Off |

The upload interface reads a server-generated capability response before it renders a file input, so a client-build flag cannot expose the form by itself. Client-visible payment flags only control what the checkout interface shows; server flags remain the enforcement boundary.

## Data flow when statement processing is enabled

1. The browser uploads the PDF and optional statement password to a Next.js route handler.
2. The application reads the PDF into a server-side `Buffer`, decrypts it, and extracts text in server memory.
3. The application zeroes its PDF buffer after extraction. The password is not logged or intentionally persisted; JavaScript strings cannot be securely zeroed and become eligible for garbage collection after the request.
4. Parsed transactions and computed analytics are kept in a **process-local in-memory map**. They are not shared across instances and disappear on a process restart.
5. Session entries expire after 30 minutes of inactivity. Accessing a session refreshes that inactivity window, and a user can delete the session explicitly.
6. Report and export buffers remain in the same process-local session until deletion or expiry. Raw parsed transactions are cleared after report generation.

The application code does not intentionally write uploaded PDFs, statement passwords, or raw transactions to disk or to a database. Hosting platforms may still buffer HTTP requests or emit infrastructure metadata outside this application’s control; review the guarantees of the environment where you deploy it.

## External integrations

- **Safaricom Daraja and Stripe:** checkout code exists but server routes reject requests unless `PAYMENTS_ENABLED=true`.
- **Neon/Postgres:** the optional benchmark endpoint is disabled by default. If enabled, it stores aggregate amounts, counts, and category percentages without direct account identifiers; it does not store raw transactions.
- **Resend:** email delivery is disabled by default. If enabled, the requested email address and generated report attachments are sent to Resend.
- **OpenRouter:** prompt helpers are not wired into the current report-generation route. The Reflect prompt builder omits contact names and phone fragments, but aggregate financial values would leave the server if an operator connects it.

No third-party analytics SDK is included on the upload or processing screens.

## Environment variables

Start from [`.env.example`](.env.example). Leave integration credentials blank until you are intentionally testing that integration in a controlled environment.

| Group | Variables |
| --- | --- |
| Daraja | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`, `MPESA_CALLBACK_TOKEN`, `MPESA_ENVIRONMENT` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Optional copy generation | `OPENROUTER_API_KEY` |
| Optional benchmarks | `DATABASE_URL` |
| Optional email | `RESEND_API_KEY` |
| Application | `NEXT_PUBLIC_APP_URL` |

## Development checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Tests that exercise the full parser use [`src/test/fixtures/synthetic-personal-statement.txt`](src/test/fixtures/synthetic-personal-statement.txt). Every identity, date, identifier, and amount in that file is invented.

Never commit real statements, extracted statement text, screenshots containing financial information, credentials, or generated reports. The ignore rules cover common statement filenames and PDF exports, but they are only a backstop—inspect every staged change before publishing.

## Architecture

- **App:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4
- **Parser:** `pdfjs-dist` plus a receipt-grouping table parser
- **Analytics:** deterministic TypeScript functions
- **Generation:** Satori, Sharp, `@react-pdf/renderer`, and CSV export
- **Sessions:** single-process in-memory map with a 30-minute inactivity TTL
- **Optional integrations:** Daraja, Stripe, Neon/Postgres, Resend, and OpenRouter

## Before production use

The current session implementation is suitable for local development and a controlled single-process demonstration—not a production financial-data service. Enabled M-Pesa callbacks require a private 32-character callback token that the application appends to the configured callback URL, but production still requires provider-side reconciliation. A production release needs, at minimum, a reviewed deployment data-flow, cross-instance session strategy, authentication/authorization, rate limiting, abuse controls, webhook verification and idempotency, observability that cannot capture financial payloads, retention enforcement, and an independent security/privacy review.

Wapi Pesa is not affiliated with Safaricom or M-Pesa.
