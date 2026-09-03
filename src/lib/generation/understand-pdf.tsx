import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { join } from "path";
import type { AnalyticsResult } from "../parser/types";
import { getHouseholdBenchmark, formatBenchmarkPosition } from "../analytics/benchmarks";

Font.register({
  family: "Inter",
  fonts: [
    { src: join(process.cwd(), "src/lib/generation/fonts/inter-400.ttf"), fontWeight: 400 },
    { src: join(process.cwd(), "src/lib/generation/fonts/inter-600.ttf"), fontWeight: 600 },
    { src: join(process.cwd(), "src/lib/generation/fonts/inter-700.ttf"), fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Inter", fontSize: 10, color: "#1a1a1a" },
  header: { marginBottom: 20, borderBottom: "1 solid #e5e5e5", paddingBottom: 15 },
  title: { fontSize: 22, fontWeight: 700, color: "#0a0a0a", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#666" },
  sectionTitle: { fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 10, color: "#0a0a0a" },
  sectionSubtitle: { fontSize: 11, fontWeight: 600, marginTop: 12, marginBottom: 6, color: "#333" },
  text: { fontSize: 10, lineHeight: 1.5, marginBottom: 4 },
  bold: { fontWeight: 600 },
  row: { flexDirection: "row", marginBottom: 4, paddingVertical: 3 },
  col: { flex: 1 },
  tableHeader: { flexDirection: "row", marginBottom: 6, paddingBottom: 4, borderBottom: "0.5 solid #ddd" },
  tableHeaderText: { fontSize: 9, fontWeight: 600, color: "#666", textTransform: "uppercase" as const },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottom: "0.5 solid #f0f0f0" },
  tableCell: { fontSize: 9.5 },
  amount: { fontSize: 10, fontWeight: 600 },
  footnote: { fontSize: 8, color: "#888", marginTop: 8, lineHeight: 1.4 },
  badge: { fontSize: 8, backgroundColor: "#f0f0f0", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2 },
  divider: { borderBottom: "0.5 solid #e5e5e5", marginVertical: 15 },
  summary: { backgroundColor: "#f8f8f8", padding: 15, borderRadius: 4, marginBottom: 15 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTop: "0.5 solid #e5e5e5", paddingTop: 8 },
  footerText: { fontSize: 8, color: "#aaa", textAlign: "center" },
});

interface UnderstandPDFProps {
  analytics: AnalyticsResult;
  recommendations: string | null;
}

export function UnderstandPDFDocument({ analytics, recommendations }: UnderstandPDFProps) {
  return (
    <Document>
      {/* Page 1: Glossary + Summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>M-Pesa Financial Report</Text>
          <Text style={styles.subtitle}>
            {analytics.period
              ? `Period: ${analytics.period.from.toLocaleDateString()} — ${analytics.period.to.toLocaleDateString()}`
              : "Statement Analysis"}
          </Text>
        </View>

        {/* Section 1: Glossary */}
        <Text style={styles.sectionTitle}>1. Transaction Glossary</Text>
        <Text style={styles.text}>
          Reference of all paybills, tills, and transaction types encountered in this statement.
        </Text>
        {analytics.topCounterpartiesByAmount.slice(0, 15).map((cp, i) => (
          <View key={i} style={styles.row}>
            <View style={{ flex: 2 }}>
              <Text style={styles.tableCell}>
                {cp.paybill ? `PAYBILL ${cp.paybill}` : cp.till ? `TILL ${cp.till}` : cp.maskedPhone || "—"}
              </Text>
            </View>
            <View style={{ flex: 3 }}>
              <Text style={styles.tableCell}>{cp.name}</Text>
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.tableCell}>KES {cp.totalAmount.toLocaleString()} ({cp.frequency}x)</Text>
            </View>
          </View>
        ))}

        {/* Section 2: Period Summary */}
        <Text style={styles.sectionTitle}>2. Period Summary</Text>
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.text}>Total Inflows</Text>
            <Text style={styles.amount}>KES {analytics.totalInflows.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.text}>Total Outflows</Text>
            <Text style={styles.amount}>KES {analytics.totalOutflows.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.text}>Net Flow</Text>
            <Text style={[styles.amount, { color: analytics.netFlow >= 0 ? "#16a34a" : "#dc2626" }]}>
              KES {analytics.netFlow.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.text}>Total Transactions</Text>
            <Text style={styles.amount}>{analytics.transactionCount}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Wapi Pesa • Confidential</Text>
        </View>
      </Page>

      {/* Page 2: Recurring Payments + Household Staff */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>3. Recurring Payments</Text>
        {analytics.recurringPayments.length === 0 ? (
          <Text style={styles.text}>No recurring payments detected in this period.</Text>
        ) : (
          analytics.recurringPayments.slice(0, 20).map((rp, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={{ flex: 3 }}>
                <Text style={styles.tableCell}>{rp.recipient}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableCell}>KES {rp.amount.toLocaleString()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableCell}>{rp.frequency}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableCell}>{rp.occurrences}x</Text>
              </View>
            </View>
          ))
        )}

        {/* Section 4: Household Staff */}
        {analytics.householdStaff.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>4. Household Staff Spending</Text>
            <Text style={styles.text}>
              Auto-detected recurring monthly payments to phone numbers with stable amounts.
            </Text>
            {analytics.householdStaff.map((hs, i) => {
              const benchmark = getHouseholdBenchmark(hs.inferredRole, hs.amount);
              return (
                <View key={i} style={{ marginBottom: 10 }}>
                  <Text style={[styles.text, styles.bold]}>
                    {hs.maskedPhone} — KES {hs.amount.toLocaleString()}/month ({hs.monthsDetected} months detected)
                  </Text>
                  {hs.inferredRole && (
                    <Text style={styles.text}>Likely role: {hs.inferredRole}</Text>
                  )}
                  {benchmark && (
                    <Text style={styles.text}>
                      Published Nairobi range: KES {benchmark.rangeMin.toLocaleString()}-{benchmark.rangeMax.toLocaleString()}.
                      Your payment is {formatBenchmarkPosition(hs.amount, benchmark.rangeMin, benchmark.rangeMax)}.
                    </Text>
                  )}
                  {benchmark && (
                    <Text style={styles.footnote}>Source: {benchmark.source}</Text>
                  )}
                </View>
              );
            })}
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Wapi Pesa • Confidential</Text>
        </View>
      </Page>

      {/* Page 3: Categorized Spending + Subscriptions */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>5. Categorized Spending</Text>
        <View style={styles.tableHeader}>
          <View style={{ flex: 3 }}><Text style={styles.tableHeaderText}>Category</Text></View>
          <View style={{ flex: 2 }}><Text style={styles.tableHeaderText}>Amount</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.tableHeaderText}>%</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.tableHeaderText}>Count</Text></View>
        </View>
        {analytics.categoryBreakdown.map((cat, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={{ flex: 3 }}><Text style={styles.tableCell}>{cat.category}</Text></View>
            <View style={{ flex: 2 }}><Text style={styles.tableCell}>KES {cat.total.toLocaleString()}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.tableCell}>{cat.percentage}%</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.tableCell}>{cat.transactionCount}</Text></View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>6. Subscription Audit</Text>
        {analytics.subscriptions.length === 0 ? (
          <Text style={styles.text}>No recurring subscriptions detected.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <View style={{ flex: 3 }}><Text style={styles.tableHeaderText}>Service</Text></View>
              <View style={{ flex: 2 }}><Text style={styles.tableHeaderText}>Monthly</Text></View>
              <View style={{ flex: 2 }}><Text style={styles.tableHeaderText}>Total</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.tableHeaderText}>Status</Text></View>
            </View>
            {analytics.subscriptions.map((sub, i) => (
              <View key={i} style={styles.tableRow}>
                <View style={{ flex: 3 }}><Text style={styles.tableCell}>{sub.name}</Text></View>
                <View style={{ flex: 2 }}><Text style={styles.tableCell}>KES {sub.monthlyCost.toLocaleString()}</Text></View>
                <View style={{ flex: 2 }}><Text style={styles.tableCell}>KES {sub.totalCost.toLocaleString()}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.tableCell}>{sub.isIdentified ? "Known" : "?"}</Text></View>
              </View>
            ))}
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Wapi Pesa • Confidential</Text>
        </View>
      </Page>

      {/* Page 4: Mobile Loans + Cash Flow */}
      <Page size="A4" style={styles.page}>
        {/* Section 7: Mobile Loan Audit */}
        {analytics.mobileLoanActivity.lenders.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>7. Mobile Loan Audit</Text>
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.text}>Total Borrowed</Text>
                <Text style={styles.amount}>KES {analytics.mobileLoanActivity.totalBorrowed.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.text}>Total Repaid</Text>
                <Text style={styles.amount}>KES {analytics.mobileLoanActivity.totalRepaid.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.text}>Total Fees/Interest</Text>
                <Text style={[styles.amount, { color: "#dc2626" }]}>
                  KES {analytics.mobileLoanActivity.totalFees.toLocaleString()}
                </Text>
              </View>
              {analytics.mobileLoanActivity.effectiveAnnualRate && (
                <View style={styles.summaryRow}>
                  <Text style={styles.text}>Effective Annual Rate (est.)</Text>
                  <Text style={styles.amount}>{analytics.mobileLoanActivity.effectiveAnnualRate}%</Text>
                </View>
              )}
            </View>
            {analytics.mobileLoanActivity.lenders.map((lender, i) => (
              <View key={i} style={styles.tableRow}>
                <View style={{ flex: 2 }}><Text style={styles.tableCell}>{lender.name}</Text></View>
                <View style={{ flex: 2 }}><Text style={styles.tableCell}>Borrowed: KES {lender.borrowed.toLocaleString()}</Text></View>
                <View style={{ flex: 2 }}><Text style={styles.tableCell}>Repaid: KES {lender.repaid.toLocaleString()}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.tableCell}>{lender.transactions} txns</Text></View>
              </View>
            ))}
          </>
        )}

        {/* Section 8: Cash Flow Patterns */}
        <Text style={styles.sectionTitle}>8. Cash Flow Patterns</Text>
        <Text style={styles.sectionSubtitle}>Monthly Breakdown</Text>
        <View style={styles.tableHeader}>
          <View style={{ flex: 2 }}><Text style={styles.tableHeaderText}>Month</Text></View>
          <View style={{ flex: 2 }}><Text style={styles.tableHeaderText}>Inflows</Text></View>
          <View style={{ flex: 2 }}><Text style={styles.tableHeaderText}>Outflows</Text></View>
          <View style={{ flex: 2 }}><Text style={styles.tableHeaderText}>Net</Text></View>
        </View>
        {analytics.monthlyTrends.map((month, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={{ flex: 2 }}><Text style={styles.tableCell}>{month.month} {month.year}</Text></View>
            <View style={{ flex: 2 }}><Text style={styles.tableCell}>KES {month.inflows.toLocaleString()}</Text></View>
            <View style={{ flex: 2 }}><Text style={styles.tableCell}>KES {month.outflows.toLocaleString()}</Text></View>
            <View style={{ flex: 2 }}>
              <Text style={[styles.tableCell, { color: month.net >= 0 ? "#16a34a" : "#dc2626" }]}>
                KES {month.net.toLocaleString()}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Wapi Pesa • Confidential</Text>
        </View>
      </Page>

      {/* Page 5: Recommendations */}
      {recommendations && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>9. Observations</Text>
          <Text style={styles.text}>
            The following are factual observations based on your transaction data. These are not financial advice.
          </Text>
          <View style={styles.divider} />
          <Text style={[styles.text, { lineHeight: 1.8 }]}>{recommendations}</Text>
          <View style={styles.divider} />
          <Text style={styles.footnote}>
            Note: These observations are generated based on patterns in your M-Pesa statement. They do not constitute financial advice.
            Consult a qualified financial advisor for personalized guidance.
          </Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Generated by Wapi Pesa • Confidential</Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
