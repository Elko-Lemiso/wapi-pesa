import { NextRequest, NextResponse } from "next/server";
import { decryptAndExtractText, PasswordRequiredError } from "@/lib/parser/pdf-decrypt";
import { extractTransactions } from "@/lib/parser/extract-transactions";
import { verifyParsedStatement } from "@/lib/parser/verify";
import { computeAnalytics } from "@/lib/analytics/primitives";
import { createSession, updateSession, type SessionMode, type UnderstandPeriod } from "@/lib/session";
import { isStatementProcessingEnabled } from "@/lib/runtime-features";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_PDF_BYTES + 256 * 1024;

export async function POST(request: NextRequest) {
  if (!isStatementProcessingEnabled()) {
    return NextResponse.json(
      {
        code: "PUBLIC_PREVIEW_ONLY",
        error: "Statement processing is not available in the public preview.",
      },
      { status: 503 },
    );
  }

  let pdfBuffer: Buffer | null = null;

  try {
    const contentLength = request.headers.get("content-length");
    const declaredLength = contentLength === null ? Number.NaN : Number(contentLength);
    if (!Number.isFinite(declaredLength) || declaredLength <= 0) {
      return NextResponse.json(
        { error: "A valid Content-Length header is required for statement uploads." },
        { status: 411 }
      );
    }
    if (declaredLength > MAX_MULTIPART_BYTES) {
      return NextResponse.json(
        { error: "That upload is larger than the 10 MB processing limit." },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    // Password is optional — many users upload statements that are already
    // unlocked (their PDF reader stripped the encryption on save, or the
    // statement was generated without a PIN to begin with).
    const password = (formData.get("password") as string | null) ?? "";
    const mode = formData.get("mode") as SessionMode | null;
    const period = formData.get("period") as UnderstandPeriod | null;

    if (!file || !mode) {
      return NextResponse.json(
        { error: "Missing required fields: file, mode" },
        { status: 400 }
      );
    }

    const looksLikePdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf) {
      return NextResponse.json(
        { error: "Upload a PDF exported from the personal M-Pesa app." },
        { status: 415 }
      );
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "That PDF is larger than the 10 MB processing limit." },
        { status: 413 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "The uploaded PDF is empty." }, { status: 400 });
    }

    if (!["reflect", "understand"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    pdfBuffer = Buffer.from(arrayBuffer);

    // Create session
    const sessionId = createSession(mode, period ?? undefined);

    // Decrypt and extract text — PIN is passed through if present, ignored
    // if blank (unencrypted statement).
    const pages = await decryptAndExtractText(pdfBuffer, password);

    // Zero out the PDF buffer immediately after extraction
    pdfBuffer.fill(0);
    pdfBuffer = null;

    // Parse transactions (with receipt-number grouping)
    const statement = extractTransactions(pages);

    if (statement.transactions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No transactions found. This preview supports personal M-Pesa Pay statements only, not Till or Paybill business statements.",
        },
        { status: 422 }
      );
    }

    // Run sanity checks
    const verification = verifyParsedStatement(statement);
    if (verification.warnings.length > 0) {
      console.warn("Parser verification warnings:", verification.warnings);
    }

    // Compute analytics
    const analytics = computeAnalytics(statement);

    // Keep the parsed statement in the process-local session until report
    // generation clears it or the session expires.
    updateSession(sessionId, {
      status: "parsed",
      analytics,
      parsedStatement: statement,
    });

    return NextResponse.json({
      sessionId,
      summary: {
        transactionCount: analytics.transactionCount,
        totalInflows: analytics.totalInflows,
        totalOutflows: analytics.totalOutflows,
        period: analytics.period,
        mode,
      },
    });
  } catch (error) {
    // Ensure buffer is cleaned up on error
    if (pdfBuffer) {
      pdfBuffer.fill(0);
    }

    if (error instanceof PasswordRequiredError) {
      // Distinct messages for "you didn't supply one" vs "the one you typed
      // is wrong" — small thing, but the right next step is different.
      return NextResponse.json(
        {
          error: error.missing
            ? "This PDF is password-protected. Enter the 6-digit PIN Safaricom sent via SMS, then upload again."
            : "Incorrect PIN. Enter the 6-digit PIN that Safaricom sent via SMS when you requested this statement.",
          passwordRequired: true,
        },
        { status: 401 }
      );
    }

    console.error("Parse error:", error);
    return NextResponse.json(
      {
        error:
          "Failed to parse statement. Use a personal M-Pesa Pay statement PDF; Till and Paybill business statements are not supported.",
      },
      { status: 500 }
    );
  }
}
