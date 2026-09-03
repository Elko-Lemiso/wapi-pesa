/**
 * Single source of truth for jargon explanations. Used by:
 *   - `<TermTooltip />` inline ⓘ markers across the dashboard
 *   - The "Help" glossary modal (Phase D)
 *   - Future copy on the landing page
 *
 * Keep entries short and concrete: 1-3 sentences max. The copy should answer
 * "what is this and why does it matter for me as the user?", not the technical
 * Safaricom definition.
 */

export interface GlossaryEntry {
  /** Short label shown inline next to the ⓘ icon. */
  label: string;
  /** 1-3 sentence body shown in the tooltip / glossary entry. */
  body: string;
  /** Long-form prose for the glossary modal. Falls back to `body`. */
  long?: string;
}

export const GLOSSARY = {
  fuliza: {
    label: "Fuliza",
    body:
      "Safaricom's overdraft. When you pay and your balance is short, Fuliza tops it up — you repay the next time money lands in your M-Pesa.",
  },
  globalpay: {
    label: "GlobalPay",
    body:
      "Paybill 903470 — Safaricom's M-Pesa Visa-style gateway used to pay foreign merchants like Netflix, Anthropic, and Apple in shillings.",
  },
  imts: {
    label: "IMTS",
    body:
      "International Money Transfer Service — incoming foreign remittances routed through Safaricom (Remitly, WorldRemit, Wise, etc.).",
  },
  paybill: {
    label: "Paybill",
    body:
      "Six-digit business number you pay into. Different from a till — paybills carry an account number you punch in along with the amount.",
  },
  till: {
    label: "Till",
    body:
      "Buy-Goods merchant number. Six or seven digits, no account number — common at supermarkets, restaurants, and small shops.",
  },
  od_loan: {
    label: "OD Loan",
    body:
      "Overdraft Loan. Most often Fuliza repayments, sometimes M-Shwari or KCB-M-Pesa. Charged a one-off fee plus daily charges until repaid.",
  },
  real_disposable_income: {
    label: "Real Disposable Income",
    body:
      "What's left after fixed obligations (rent-equivalents, subscriptions, household staff, recurring bills) but before discretionary spending.",
  },
  fragility_day: {
    label: "Fragility Day",
    body:
      "The day of the month your balance is consistently lowest. If money lands the day before, you've been running close to empty for a stretch.",
  },
  runway: {
    label: "Runway",
    body:
      "Months your current balance covers, assuming zero new income, at your current essentials spend rate.",
  },
  leak_total: {
    label: "Leak Total",
    body:
      "Recurring sub-KES-500 charges that quietly add up. Annualised across all of them — the kind of stuff people don't know they're paying for.",
  },
  inflation_exposure: {
    label: "Inflation Exposure",
    body:
      "Price drift across your stable recurring merchants (utilities, subscriptions). Variable bills are excluded — only same-merchant, same-cadence charges count.",
  },
  income_predictability: {
    label: "Income Predictability",
    body:
      "How spread-out your monthly inflows are. Lower = stable salary-like rhythm. Higher = lumpy income (freelance, business, gig).",
  },
  trajectory: {
    label: "Trajectory",
    body:
      "Whether your monthly net (income minus spending) is trending up, down, or flat. The sign tells you direction; the size tells you how fast.",
  },
  cv: {
    label: "Coefficient of Variation",
    body:
      "Standard deviation divided by the mean. A unitless ratio of how much something varies relative to its typical value. Below 0.3 means quite stable.",
  },
  reconciliation: {
    label: "Reconciliation",
    body:
      "Sanity check: money in − money out − fees should equal the change in your balance. We surface it so you know the report adds up to what your bank says.",
  },
  partial_month: {
    label: "Partial Month",
    body:
      "A month at the start or end of the statement that doesn't span all its days. We exclude these from busiest/quietest comparisons so the numbers stay apples-to-apples.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
