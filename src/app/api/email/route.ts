import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { getSession } from "@/lib/session";
import { isEmailDeliveryEnabled } from "@/lib/runtime-features";

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  if (!isEmailDeliveryEnabled()) {
    return NextResponse.json(
      {
        code: "SHOWCASE_EMAIL_DISABLED",
        error: "Email delivery is disabled in this showcase deployment.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { sessionId, email } = requestSchema.parse(body);

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
    }

    if (session.status !== "delivered" || !session.reportBuffer) {
      return NextResponse.json({ error: "Report not ready" }, { status: 400 });
    }

    const modeName = session.mode === "reflect" ? "Reflect" : "Understand";
    const attachments = [
      {
        filename: `wapi-pesa-${session.mode}-report.pdf`,
        content: session.reportBuffer.toString("base64"),
      },
    ];

    if (session.csvBuffer) {
      attachments.push({
        filename: "mpesa-transactions-categorized.csv",
        content: session.csvBuffer.toString("base64"),
      });
    }

    const resend = getResendClient();
    const { error: deliveryError } = await resend.emails.send({
      from: "Wapi Pesa <reports@wapipesa.co.ke>",
      to: email,
      subject: `Your M-Pesa ${modeName} Report`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0a1628;">Your M-Pesa ${modeName} Report</h2>
          <p style="color: #666;">Your report is attached to this email. Thank you for using Wapi Pesa.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">
            This email was sent because you requested it. We do not store your email address.
            No further emails will be sent unless you request another report.
          </p>
        </div>
      `,
      attachments,
    });

    if (deliveryError) {
      console.error("Email provider rejected delivery:", deliveryError);
      return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    console.error("Email send error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
