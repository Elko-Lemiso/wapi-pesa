import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSession, updateSession } from "@/lib/session";
import { UnderstandPDFDocument } from "@/lib/generation/understand-pdf";
import { generateReflectReport } from "@/lib/generation/reflect-pdf";
import { buildCardManifest, generateShareCards } from "@/lib/generation/reflect-cards";
import { generateCSV } from "@/lib/generation/csv-export";
import { buildReflectCards } from "@/lib/generation/build-cards";
import React from "react";
import { canAccessPaidReport } from "@/lib/runtime-features";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = requestSchema.parse(body);

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
    }

    if (!session.analytics) {
      return NextResponse.json({ error: "No analytics data available" }, { status: 400 });
    }

    if (!canAccessPaidReport(session.status)) {
      return NextResponse.json(
        { error: "Payment confirmation is required before report generation." },
        { status: 402 }
      );
    }

    updateSession(sessionId, { status: "generating" });

    if (session.mode === "understand") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfBuffer = await (renderToBuffer as any)(
        React.createElement(UnderstandPDFDocument, {
          analytics: session.analytics,
          recommendations: null,
        })
      );

      let csvBuffer: Buffer | null = null;
      if (session.parsedStatement) {
        csvBuffer = generateCSV(session.parsedStatement);
      }

      updateSession(sessionId, {
        status: "delivered",
        reportBuffer: Buffer.from(pdfBuffer),
        csvBuffer,
        parsedStatement: null,
      });

      return NextResponse.json({ success: true, sessionId, mode: "understand" });
    } else {
      // Reflect mode — build cards from analytics data directly. We also
      // build a privacy-masked variant so the client can toggle "mask names"
      // without round-tripping for a regen.
      const cards = buildReflectCards(session.analytics);
      const privateCards = buildReflectCards(session.analytics, { privacyMode: true });

      // Generate share card PNGs (story + poster per card, plus privacy variants)
      let cardBuffers: Map<string, Buffer> | null = null;
      if (cards.length > 0) {
        cardBuffers = await generateShareCards(cards, session.analytics, privateCards);
      }

      // Generate PDF compilation
      const pdfBuffer = await generateReflectReport(cards, session.analytics);

      // Lightweight manifest for the client UI — what cards exist, what
      // download keys to use, etc. The actual buffers stay on the server.
      const manifest = buildCardManifest(cards);

      updateSession(sessionId, {
        status: "delivered",
        reportBuffer: pdfBuffer,
        cardBuffers,
        cardManifest: manifest,
        parsedStatement: null,
      });

      return NextResponse.json({
        success: true,
        sessionId,
        mode: "reflect",
        cardCount: cards.length,
        cards: manifest,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Generation error:", error);
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}
