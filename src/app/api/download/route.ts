import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const type = request.nextUrl.searchParams.get("type") || "pdf";
  const cardName = request.nextUrl.searchParams.get("card");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  if (session.status !== "delivered") {
    return NextResponse.json({ error: "Report not ready" }, { status: 400 });
  }

  if (type === "pdf" && session.reportBuffer) {
    return new NextResponse(new Uint8Array(session.reportBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="wapi-pesa-report.pdf"`,
      },
    });
  }

  if (type === "csv" && session.csvBuffer) {
    return new NextResponse(new Uint8Array(session.csvBuffer), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="mpesa-transactions.csv"`,
      },
    });
  }

  if (type === "card" && cardName && session.cardBuffers) {
    const cardBuffer = session.cardBuffers.get(cardName);
    if (cardBuffer) {
      return new NextResponse(new Uint8Array(cardBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${cardName}.png"`,
        },
      });
    }
  }

  return NextResponse.json({ error: "Requested content not available" }, { status: 404 });
}
