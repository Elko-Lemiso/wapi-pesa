export interface HouseholdBenchmark {
  role: string;
  userPayment: number;
  rangeMin: number;
  rangeMax: number;
  source: string;
  sourceUrl: string;
}

// Published Kenyan domestic worker wage data
// Sources: Kenya Domestic Workers Council, FIDA Kenya, Ministry of Labour
const HOUSEHOLD_BENCHMARKS: Record<string, { min: number; max: number; source: string; url: string }> = {
  "Live-in domestic worker or driver": {
    min: 20000,
    max: 50000,
    source: "Kenya Domestic Workers Council 2024, Nairobi rates",
    url: "https://www.labour.go.ke/minimum-wages",
  },
  "Full-time housekeeper or cook": {
    min: 15000,
    max: 30000,
    source: "Kenya Domestic Workers Council 2024, Nairobi rates",
    url: "https://www.labour.go.ke/minimum-wages",
  },
  "Part-time worker, gardener, or watchman": {
    min: 8000,
    max: 20000,
    source: "Ministry of Labour General Wages Order 2024",
    url: "https://www.labour.go.ke/minimum-wages",
  },
  "Casual worker or part-time helper": {
    min: 3000,
    max: 12000,
    source: "Ministry of Labour Domestic Workers Minimum Wage 2024",
    url: "https://www.labour.go.ke/minimum-wages",
  },
};

export function getHouseholdBenchmark(
  role: string | null,
  amount: number
): HouseholdBenchmark | null {
  if (!role) return null;

  const benchmark = HOUSEHOLD_BENCHMARKS[role];
  if (!benchmark) return null;

  return {
    role,
    userPayment: amount,
    rangeMin: benchmark.min,
    rangeMax: benchmark.max,
    source: benchmark.source,
    sourceUrl: benchmark.url,
  };
}

export function formatBenchmarkPosition(
  amount: number,
  min: number,
  max: number
): string {
  if (amount < min) return "below the published range";
  if (amount > max) return "above the published range";

  const position = (amount - min) / (max - min);
  if (position < 0.33) return "on the lower end of the range";
  if (position > 0.66) return "on the higher end of the range";
  return "within the typical range";
}
