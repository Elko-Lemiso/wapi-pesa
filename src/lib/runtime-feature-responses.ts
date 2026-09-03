import { NextResponse } from "next/server";

export function paymentsDisabledResponse() {
  return NextResponse.json(
    {
      code: "SHOWCASE_PAYMENTS_DISABLED",
      error: "Payments are disabled in this showcase deployment.",
    },
    { status: 503 }
  );
}
