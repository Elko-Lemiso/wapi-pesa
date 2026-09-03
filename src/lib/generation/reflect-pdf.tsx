import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { join } from "path";
import type { ReflectCard } from "./build-cards";
import type { AnalyticsResult } from "../parser/types";

Font.register({
  family: "SpaceGrotesk",
  fonts: [
    { src: join(process.cwd(), "src/lib/generation/fonts/space-grotesk-700.ttf"), fontWeight: 700 },
    { src: join(process.cwd(), "src/lib/generation/fonts/space-grotesk-400.ttf"), fontWeight: 400 },
  ],
});

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0a1628",
    padding: 0,
    fontFamily: "SpaceGrotesk",
  },
  card: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: 60,
    position: "relative",
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#ff6b4a",
  },
  headline: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: 700,
    lineHeight: 1.3,
    marginBottom: 20,
  },
  body: {
    color: "#94a3b8",
    fontSize: 18,
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 60,
    color: "#334155",
    fontSize: 12,
  },
  statsPage: {
    backgroundColor: "#0f172a",
    padding: 60,
    fontFamily: "SpaceGrotesk",
  },
  statsTitle: {
    color: "#f5b731",
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 40,
  },
  statRow: {
    flexDirection: "row",
    marginBottom: 20,
    alignItems: "center",
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 14,
    flex: 1,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 700,
    flex: 1,
    textAlign: "right",
  },
});

const ACCENT_COLORS: Record<string, string> = {
  headline: "#ff6b4a",
  topPaybill: "#f5b731",
  topPerson: "#8b5cf6",
  restaurants: "#f5b731",
  lateNights: "#8b5cf6",
  subscriptions: "#ff6b4a",
  transport: "#00d68f",
  sendMoney: "#ff6b4a",
  punchline: "#00d68f",
  stats: "#f5b731",
};

interface ReflectPDFProps {
  cards: ReflectCard[];
  analytics: AnalyticsResult;
}

function ReflectPDFDocument({ cards, analytics }: ReflectPDFProps) {
  return (
    <Document>
      {cards.map((card, i) => (
        <Page key={i} size={[595, 842]} style={styles.page}>
          <View style={styles.card}>
            <View style={[styles.accentBar, { backgroundColor: ACCENT_COLORS[card.cardType] || "#ff6b4a" }]} />
            <Text style={styles.headline}>{card.headline}</Text>
            <Text style={styles.body}>{card.body}</Text>
            <Text style={styles.footer}>wapipesa.co.ke</Text>
          </View>
        </Page>
      ))}

      {/* Stats summary page */}
      <Page size={[595, 842]} style={styles.statsPage}>
        <Text style={styles.statsTitle}>Your Year in Numbers</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Transactions</Text>
          <Text style={styles.statValue}>{analytics.transactionCount.toLocaleString()}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Money Moved</Text>
          <Text style={styles.statValue}>
            KES {(analytics.totalInflows + analytics.totalOutflows).toLocaleString()}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Biggest Single Transaction</Text>
          <Text style={styles.statValue}>
            KES {analytics.extremes.biggestSingleTransaction.amount.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Longest M-Pesa Streak</Text>
          <Text style={styles.statValue}>{analytics.streaks.longestConsecutiveDays} days</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Busiest Day</Text>
          <Text style={styles.statValue}>
            {analytics.streaks.busiestDay.date} ({analytics.streaks.busiestDay.count} txns)
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Quietest Month</Text>
          <Text style={styles.statValue}>{analytics.streaks.quietestMonth.month}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Late Night Transactions</Text>
          <Text style={styles.statValue}>{analytics.timePatterns.lateNightTransactions.count}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Recurring Subscriptions</Text>
          <Text style={styles.statValue}>{analytics.subscriptions.length}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateReflectReport(
  cards: ReflectCard[],
  analytics: AnalyticsResult
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await (renderToBuffer as any)(
    React.createElement(ReflectPDFDocument, { cards, analytics })
  );
  return Buffer.from(pdfBuffer);
}
