import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initiateSTKPush } from "@/lib/payments/daraja";
import { getSession, updateSession } from "@/lib/session";
import { registerPaymentRef } from "@/lib/session-lookup";
import { isPaymentProcessingEnabled } from "@/lib/runtime-features";
import { getKesPrice } from "@/lib/pricing";
import { paymentsDisabledResponse } from "@/lib/runtime-feature-responses";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  phoneNumber: z.string().min(10).max(15),
});

export async function POST(request: NextRequest) {
  if (!isPaymentProcessingEnabled()) {
    return paymentsDisabledResponse();
  }

  try {
    const body = await request.json();
    const { sessionId, phoneNumber } = requestSchema.parse(body);

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
    }

    if (session.status !== "parsed") {
      return NextResponse.json({ error: "Invalid session state for payment" }, { status: 400 });
    }

    const amount = getKesPrice(session.mode, session.understandPeriod);

    const response = await initiateSTKPush({
      phoneNumber,
      amount,
      accountReference: `MPINS-${sessionId.slice(0, 8)}`,
      description: `Wapi Pesa ${session.mode === "reflect" ? "Reflect" : "Understand"} Report`,
    });

    if (response.ResponseCode === "0") {
      updateSession(sessionId, {
        status: "payment_pending",
        paymentReference: response.CheckoutRequestID,
      });
      registerPaymentRef(response.CheckoutRequestID, sessionId);

      return NextResponse.json({
        success: true,
        checkoutRequestId: response.CheckoutRequestID,
        message: response.CustomerMessage,
      });
    }

    return NextResponse.json(
      { error: response.ResponseDescription },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }
    console.error("STK Push error:", error);
    return NextResponse.json({ error: "Payment initiation failed" }, { status: 500 });
  }
}
