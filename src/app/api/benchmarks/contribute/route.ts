import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { contributeAnonymizedData } from "@/lib/db/contribute";
import { isBenchmarkContributionEnabled } from "@/lib/runtime-features";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  if (!isBenchmarkContributionEnabled()) {
    return NextResponse.json(
      {
        code: "SHOWCASE_CONTRIBUTION_DISABLED",
        error: "Benchmark contribution is disabled in this showcase deployment.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { sessionId } = requestSchema.parse(body);

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
    }

    if (!session.analytics) {
      return NextResponse.json({ error: "No analytics data to contribute" }, { status: 400 });
    }

    await contributeAnonymizedData(session.analytics);

    return NextResponse.json({
      success: true,
      message: "Thank you! Your anonymized data helps improve benchmarks for everyone.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Benchmark contribution error:", error);
    return NextResponse.json({ error: "Contribution failed" }, { status: 500 });
  }
}
