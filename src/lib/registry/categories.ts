export const CATEGORIES = {
  // 14 top-level taxonomy described in the categorisation prompt
  food_dining: "Food & Dining",
  groceries: "Groceries",
  transport: "Transport",
  utilities: "Utilities",
  subscriptions: "Subscriptions",
  banking: "Banking & Lending",
  insurance: "Insurance & Savings",
  healthcare: "Healthcare",
  government: "Government & Taxes",
  personal: "Person-to-Person",
  domestic_services: "Domestic & Personal Services",
  shopping: "Shopping",
  self_transfer: "Self-Transfers",
  uncategorized: "Uncategorized",

  // Legacy keys still emitted by older code paths — kept as aliases so
  // existing analytics keep rendering. Layer 5 categorisation will consolidate.
  restaurants: "Food & Dining",
  entertainment: "Shopping",
  connectivity: "Utilities",
  ecommerce: "Shopping",
  education: "Government & Taxes",
  religious: "Person-to-Person",
  real_estate: "Utilities",
  agent: "Banking & Lending",
  airtime: "Utilities",
  savings: "Insurance & Savings",
  international: "Person-to-Person",
  unknown: "Uncategorized",
} as const;

export type Category = keyof typeof CATEGORIES;

export const MOBILE_LENDERS = [
  "tala",
  "branch",
  "zenka",
  "okash",
  "kcb_mpesa",
  "mshwari",
  "fuliza",
  "hustler_fund",
  "timiza",
  "ipesa",
] as const;

export const LENDER_NAMES: Record<string, string> = {
  tala: "Tala",
  branch: "Branch",
  zenka: "Zenka",
  okash: "Okash",
  kcb_mpesa: "KCB M-Pesa",
  mshwari: "M-Shwari",
  fuliza: "Fuliza",
  hustler_fund: "Hustler Fund",
  timiza: "Timiza",
  ipesa: "iPesa",
};
