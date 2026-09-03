import { readFileSync } from "fs";
import { decryptAndExtractText } from "../src/lib/parser/pdf-decrypt";
import { extractTransactions } from "../src/lib/parser/extract-transactions";
import { computeAnalytics } from "../src/lib/analytics/primitives";

async function main() {
  const pdfPath = process.argv[2];
  const password = process.env.MPESA_STATEMENT_PASSWORD || "";

  if (!pdfPath) {
    console.error(
      "Usage: MPESA_STATEMENT_PASSWORD='<optional-password>' npx tsx scripts/test-parse.ts /path/to/local-statement.pdf"
    );
    process.exit(2);
  }

  console.log(`Parsing: ${pdfPath}`);

  const buffer = readFileSync(pdfPath);
  console.log(`File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  console.log("\nDecrypting and extracting text...");
  const pages = await decryptAndExtractText(buffer, password);
  console.log(`Extracted ${pages.length} pages`);

  console.log("\nParsing transactions...");
  const statement = extractTransactions(pages);
  console.log(`Found ${statement.transactions.length} transactions`);
  console.log(`Period: ${JSON.stringify(statement.statementPeriod)}`);

  console.log("\nComputing analytics...");
  const analytics = computeAnalytics(statement);
  console.log(`Total inflows: KES ${analytics.totalInflows.toLocaleString()}`);
  console.log(`Total outflows: KES ${analytics.totalOutflows.toLocaleString()}`);
  console.log(`Net flow: KES ${analytics.netFlow.toLocaleString()}`);
  console.log(`Transaction count: ${analytics.transactionCount}`);

  console.log("\nTop 5 categories:");
  analytics.categoryBreakdown.slice(0, 5).forEach((cat) => {
    console.log(`  ${cat.category}: KES ${cat.total.toLocaleString()} (${cat.percentage}%)`);
  });

  console.log("\nRecurring payments detected:", analytics.recurringPayments.length);
  console.log("Household staff detected:", analytics.householdStaff.length);
  console.log("Mobile lenders detected:", analytics.mobileLoanActivity.lenders.length);
  console.log("Subscriptions detected:", analytics.subscriptions.length);

  console.log("\nDone!");
}

main().catch(console.error);
