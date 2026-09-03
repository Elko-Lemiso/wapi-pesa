import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyWebhookSignature } from "@/lib/payments/stripe";
import { getSession, updateSession } from "@/lib/session";
import { isPaymentProcessingEnabled } from "@/lib/runtime-features";
import { paymentsDisabledResponse } from "@/lib/runtime-feature-responses";

export async function POST(request: NextRequest) {
  if (!isPaymentProcessingEnabled()) {
    return paymentsDisabledResponse();
  }

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const event = await verifyWebhookSignature(body, signature);

    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const sessionId = checkoutSession.metadata?.sessionId;
      const paymentReference =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id ?? null;

      if (sessionId) {
        const session = getSession(sessionId);
        if (session) {
          updateSession(sessionId, {
            status: "payment_confirmed",
            paymentReference,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
