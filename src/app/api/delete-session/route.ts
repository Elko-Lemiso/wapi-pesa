import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { destroySession, getSession } from "@/lib/session";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = requestSchema.parse(body);

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ success: true, message: "Session already deleted or expired" });
    }

    destroySession(sessionId);

    return NextResponse.json({
      success: true,
      message: "All session data has been permanently deleted",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
