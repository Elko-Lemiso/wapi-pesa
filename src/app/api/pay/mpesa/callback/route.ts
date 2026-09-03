import { NextRequest, NextResponse } from "next/server";
import { parseCallback, type CallbackData } from "@/lib/payments/daraja";
import { updateSession } from "@/lib/session";
import { isPaymentProcessingEnabled } from "@/lib/runtime-features";
import { paymentsDisabledResponse } from "@/lib/runtime-feature-responses";
import { isValidMpesaCallbackToken } from "@/lib/payments/callback-auth";

export async function POST(request: NextRequest) {
  if (!isPaymentProcessingEnabled()) {
    return paymentsDisabledResponse();
  }

  if (!isValidMpesaCallbackToken(request.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ error: "Unauthorized callback" }, { status: 401 });
  }

  try {
    const data: CallbackData = await request.json();
    const result = parseCallback(data);

    // Find the session with this checkout request ID
    // In production, you'd use a proper lookup. For now we'll scan sessions.
    // This is acceptable for single-server deployment.
    const { findSessionByPaymentRef } = await import("@/lib/session-lookup");
    const session = findSessionByPaymentRef(result.checkoutRequestId);

    if (!session) {
      // Callback for unknown session — log but don't fail
      console.warn("Callback for unknown checkout:", result.checkoutRequestId);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (result.success) {
      updateSession(session.id, {
        status: "payment_confirmed",
        paymentReference: result.receiptNumber || result.checkoutRequestId,
      });
    } else {
      updateSession(session.id, {
        status: "parsed", // Reset to allow retry
      });
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Callback processing error:", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
