import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { computeAnalytics } from "@/lib/analytics/primitives";
import type { ParsedStatement } from "@/lib/parser/types";
import { canAccessPaidReport } from "@/lib/runtime-features";

/**
 * Recompute analytics for an arbitrary date window inside the parsed statement.
 *
 * The parsed statement (raw transactions) lives only in memory inside the
 * server-side session map. This endpoint never reaches a database — it just
 * filters the in-memory transactions and re-runs the analytics pipeline.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { sessionId, from, to, compare } = body as {
    sessionId?: string;
    from?: string | null;
    to?: string | null;
    /** When `"previous"`, also returns analytics for the equally-long
     *  preceding window so the UI can render deltas. */
    compare?: "previous" | null;
  };

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  if (!canAccessPaidReport(session.status)) {
    return NextResponse.json(
      { error: "Payment confirmation is required before analytics access." },
      { status: 402 }
    );
  }

  if (!session.parsedStatement) {
    return NextResponse.json({ error: "No parsed statement in session" }, { status: 400 });
  }

  const fromDate = parseBoundary(from);
  const toDate = parseBoundary(to);

  const filtered = applyRange(session.parsedStatement, fromDate, toDate);
  const analytics = computeAnalytics(filtered);

  // Comparison: equally-long window immediately before the current one.
  let previous: { analytics: ReturnType<typeof computeAnalytics>; from: string; to: string } | null = null;
  if (compare === "previous" && fromDate && toDate) {
    const span = toDate.getTime() - fromDate.getTime();
    if (span > 0) {
      const prevTo = new Date(fromDate.getTime() - 1);
      const prevFrom = new Date(fromDate.getTime() - 1 - span);
      const statementStart = session.parsedStatement.statementPeriod?.from
        ? new Date(session.parsedStatement.statementPeriod.from)
        : null;
      // Only compute if the previous window has at least one full day inside
      // the statement's coverage. Otherwise it'd be all zeros and noisy.
      if (!statementStart || prevTo.getTime() >= statementStart.getTime()) {
        const prevSlice = applyRange(session.parsedStatement, prevFrom, prevTo);
        previous = {
          analytics: computeAnalytics(prevSlice),
          from: prevFrom.toISOString(),
          to: prevTo.toISOString(),
        };
      }
    }
  }

  return NextResponse.json({
    analytics,
    range: {
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate ? toDate.toISOString() : null,
    },
    previous,
  });
}

function parseBoundary(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function applyRange(
  statement: ParsedStatement,
  from: Date | null,
  to: Date | null
): ParsedStatement {
  if (!from && !to) return statement;

  const inRange = (t: { completionTime: Date }) => {
    const ts = new Date(t.completionTime).getTime();
    if (from && ts < from.getTime()) return false;
    if (to && ts > to.getTime()) return false;
    return true;
  };

  const transactions = statement.transactions.filter(inRange);

  // Restrict the reported `statementPeriod` to the slice the user picked. The
  // un-sliced period stays available on the original parsed statement (for the
  // "Statement covers X – Y" header in the dashboard).
  const period =
    statement.statementPeriod && (from || to)
      ? {
          from: from ?? statement.statementPeriod.from,
          to: to ?? statement.statementPeriod.to,
        }
      : statement.statementPeriod;

  return {
    ...statement,
    transactions,
    statementPeriod: period,
  };
}
