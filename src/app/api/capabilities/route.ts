import { NextResponse } from "next/server";
import {
  isEmailDeliveryEnabled,
  isPaymentProcessingEnabled,
  isStatementProcessingEnabled,
} from "@/lib/runtime-features";

export async function GET() {
  return NextResponse.json(
    {
      statementProcessing: isStatementProcessingEnabled(),
      payments: isPaymentProcessingEnabled(),
      emailDelivery: isEmailDeliveryEnabled(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
