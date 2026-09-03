import Stripe from "stripe";
import { getKesPrice } from "../pricing";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export interface CreateCheckoutOptions {
  sessionId: string;
  mode: "reflect" | "understand";
  understandPeriod?: "single_month" | "annual" | null;
}

// KES to USD approximate conversion for international cards
const KES_TO_USD = 0.0065;

export async function createCheckoutSession(options: CreateCheckoutOptions): Promise<string> {
  const { sessionId, mode, understandPeriod } = options;
  const kes = getKesPrice(mode, understandPeriod);
  const usd = Math.ceil(kes * KES_TO_USD * 100) / 100;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const modeName = mode === "reflect" ? "Reflect" : "Understand";
  const periodLabel = understandPeriod === "single_month" ? " (Monthly)" : understandPeriod === "annual" ? " (Annual)" : "";
  const successPath = mode === "reflect" ? "report" : "dashboard";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Wapi Pesa ${modeName} Report${periodLabel}`,
            description: `One-time financial analysis report (KES ${kes.toLocaleString()})`,
          },
          unit_amount: Math.round(usd * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${appUrl}/${successPath}?sessionId=${sessionId}`,
    cancel_url: `${appUrl}/payment?sessionId=${sessionId}&mode=${mode}${understandPeriod ? `&period=${understandPeriod}` : ""}`,
    metadata: {
      sessionId,
      mode,
    },
  });

  return session.url!;
}

export async function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
