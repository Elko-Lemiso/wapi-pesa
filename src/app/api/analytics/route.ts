import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canAccessPaidReport } from "@/lib/runtime-features";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  if (!session.analytics) {
    return NextResponse.json({ error: "Analytics not yet available" }, { status: 400 });
  }

  if (!canAccessPaidReport(session.status)) {
    return NextResponse.json(
      { error: "Payment confirmation is required before analytics access." },
      { status: 402 }
    );
  }

  return NextResponse.json({
    analytics: session.analytics,
    mode: session.mode,
    status: session.status,
  });
}
