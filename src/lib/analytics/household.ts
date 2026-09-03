import type { Transaction, HouseholdStaffPayment } from "../parser/types";

export function detectHouseholdStaff(transactions: Transaction[]): HouseholdStaffPayment[] {
  // Look for recurring monthly payments to phone numbers (not paybills/tills)
  // with stable amounts — likely helpers, gardeners, drivers, watchmen
  const phonePayments = transactions.filter(
    (t) =>
      t.direction === "out" &&
      t.counterparty.phoneNumber &&
      !t.counterparty.paybillNumber &&
      !t.counterparty.tillNumber &&
      (t.type === "send_money" || t.type === "unknown")
  );

  // Group by phone number
  const byPhone = new Map<string, Transaction[]>();
  for (const t of phonePayments) {
    const phone = t.counterparty.phoneNumber!;
    if (!byPhone.has(phone)) byPhone.set(phone, []);
    byPhone.get(phone)!.push(t);
  }

  const results: HouseholdStaffPayment[] = [];

  for (const [phone, txns] of byPhone) {
    if (txns.length < 2) continue;

    // Check for monthly pattern
    const sorted = [...txns].sort(
      (a, b) => a.completionTime.getTime() - b.completionTime.getTime()
    );

    const months = new Set<string>();
    for (const t of sorted) {
      months.add(
        `${t.completionTime.getFullYear()}-${t.completionTime.getMonth()}`
      );
    }

    // Must appear in at least 2 different months
    if (months.size < 2) continue;

    // Check amount stability
    const amounts = sorted.map((t) => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    // Amount should be relatively stable (within 30% of average)
    const isStable = amounts.every(
      (a) => Math.abs(a - avgAmount) / avgAmount < 0.3
    );
    if (!isStable) continue;

    // Amount should look like a salary (typically KES 3,000 - 60,000)
    if (avgAmount < 2000 || avgAmount > 80000) continue;

    // Check interval is roughly monthly
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff =
        (sorted[i].completionTime.getTime() -
          sorted[i - 1].completionTime.getTime()) /
        (1000 * 60 * 60 * 24);
      gaps.push(diff);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    // Average gap should be roughly monthly (20-40 days)
    if (avgGap < 20 || avgGap > 45) continue;

    const totalPaid = amounts.reduce((a, b) => a + b, 0);
    const role = inferRole(avgAmount);

    results.push({
      maskedPhone: maskPhone(phone),
      amount: Math.round(avgAmount),
      frequency: "monthly",
      totalPaid: Math.round(totalPaid),
      monthsDetected: months.size,
      inferredRole: role,
    });
  }

  return results.sort((a, b) => b.totalPaid - a.totalPaid);
}

function inferRole(monthlyAmount: number): string | null {
  // Based on typical Kenyan domestic worker wage ranges (Nairobi)
  if (monthlyAmount >= 25000 && monthlyAmount <= 60000) {
    return "Live-in domestic worker or driver";
  }
  if (monthlyAmount >= 15000 && monthlyAmount <= 30000) {
    return "Full-time housekeeper or cook";
  }
  if (monthlyAmount >= 8000 && monthlyAmount <= 18000) {
    return "Part-time worker, gardener, or watchman";
  }
  if (monthlyAmount >= 3000 && monthlyAmount <= 10000) {
    return "Casual worker or part-time helper";
  }
  return "Regular payment recipient (possible household staff)";
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 4)}XX XXX ${phone.slice(-3)}`;
}
