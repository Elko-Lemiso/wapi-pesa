import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/session";
import { computeAnalytics } from "@/lib/analytics/primitives";
import { canAccessPaidReport } from "@/lib/runtime-features";

export async function POST(request: NextRequest) {
  const { sessionId } = await request.json();

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  if (!canAccessPaidReport(session.status)) {
    return NextResponse.json(
      { error: "Payment confirmation is required before re-analysis." },
      { status: 402 }
    );
  }

  if (!session.parsedStatement) {
    return NextResponse.json({ error: "No parsed statement in session" }, { status: 400 });
  }

  const analytics = computeAnalytics(session.parsedStatement);
  updateSession(sessionId, { analytics });

  return NextResponse.json({ analytics });
}
