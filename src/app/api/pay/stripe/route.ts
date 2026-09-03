import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSession } from "@/lib/payments/stripe";
import { getSession } from "@/lib/session";
import { isPaymentProcessingEnabled } from "@/lib/runtime-features";
import { paymentsDisabledResponse } from "@/lib/runtime-feature-responses";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  if (!isPaymentProcessingEnabled()) {
    return paymentsDisabledResponse();
  }

  try {
    const body = await request.json();
    const { sessionId } = requestSchema.parse(body);

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
    }

    if (session.status !== "parsed") {
      return NextResponse.json({ error: "Invalid session state" }, { status: 400 });
    }

    const url = await createCheckoutSession({
      sessionId,
      mode: session.mode,
      understandPeriod: session.understandPeriod,
    });

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
