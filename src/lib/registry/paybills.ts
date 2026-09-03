import type { Category } from "./categories";

export interface PaybillEntry {
  number: string;
  name: string;
  category: Category;
  description?: string;
}

export interface TillEntry {
  number: string;
  name: string;
  category: Category;
}

/**
 * High-frequency Kenyan paybills (Layer 1 of the classification pipeline).
 * Categories use the consolidated 14-category taxonomy (see ./categories.ts).
 *
 * Special paybills:
 *   - 903470  GlobalPay   → handled by Layer 2 (GlobalPay merchant extraction).
 *   - 510800  iPay        → opaque payment aggregator; treated as Shopping.
 *   - 220333  Pesapal     → opaque payment aggregator; treated as Shopping.
 */
const PAYBILL_REGISTRY: PaybillEntry[] = [
  // === UTILITIES ===
  { number: "247247", name: "Kenya Power (KPLC)", category: "utilities", description: "Postpaid electricity" },
  { number: "888880", name: "Kenya Power (Prepaid)", category: "utilities", description: "Prepaid electricity tokens" },
  { number: "200200", name: "Nairobi Water", category: "utilities" },
  { number: "444000", name: "Nairobi Water (Alt)", category: "utilities" },
  { number: "505050", name: "Eldoret Water", category: "utilities" },
  { number: "150501", name: "Safaricom Home", category: "utilities", description: "Safaricom Home internet" },
  { number: "220220", name: "Safaricom Home Fibre", category: "utilities" },
  { number: "100100", name: "Safaricom", category: "utilities", description: "Mobile and fibre services" },
  { number: "777000", name: "Zuku", category: "utilities", description: "Internet and TV" },
  { number: "555555", name: "Faiba / JTL", category: "utilities", description: "Internet and mobile" },
  { number: "111555", name: "Telkom Kenya", category: "utilities" },
  { number: "800400", name: "Liquid Telecom", category: "utilities" },
  { number: "450450", name: "Poa Internet", category: "utilities" },
  { number: "244441", name: "Safaricom Postpaid", category: "utilities" },

  // === GOVERNMENT & TAXES ===
  { number: "444444", name: "Kenya Revenue Authority (KRA)", category: "government" },
  { number: "522522", name: "KRA iTax", category: "government" },
  { number: "206206", name: "eCitizen", category: "government", description: "Government online services" },
  { number: "572572", name: "NTSA", category: "government", description: "National Transport and Safety Authority" },
  { number: "110110", name: "Nairobi County", category: "government" },
  { number: "848484", name: "Mombasa County", category: "government" },
  { number: "333000", name: "Kisumu County", category: "government" },
  { number: "765765", name: "Kiambu County", category: "government" },
  { number: "100100", name: "Huduma Centre", category: "government" },

  // === HEALTHCARE ===
  { number: "880100", name: "NHIF / SHA", category: "healthcare" },
  { number: "333222", name: "NHIF (Alt)", category: "healthcare" },
  { number: "222055", name: "Kenyatta National Hospital", category: "healthcare" },
  { number: "811222", name: "Nairobi Hospital", category: "healthcare" },
  { number: "525525", name: "Aga Khan Hospital", category: "healthcare" },
  { number: "600600", name: "Mater Hospital", category: "healthcare" },
  { number: "800222", name: "Karen Hospital", category: "healthcare" },
  { number: "878787", name: "M.P. Shah Hospital", category: "healthcare" },
  { number: "300200", name: "Avenue Healthcare", category: "healthcare" },
  { number: "6556555", name: "Mater Heart Fund", category: "healthcare" },

  // === BANKING & LENDING ===
  { number: "972900", name: "KCB M-Pesa", category: "banking" },
  { number: "907950", name: "Paramount Bank", category: "banking", description: "Paramount Bank loan repayments" },
  { number: "513613", name: "Tala", category: "banking" },
  { number: "725665", name: "Branch", category: "banking" },
  { number: "290290", name: "Equity Bank", category: "banking" },
  { number: "400200", name: "Co-operative Bank", category: "banking" },
  { number: "504900", name: "NCBA Bank", category: "banking", description: "NCBA salary disbursements" },
  { number: "211211", name: "NCBA M-Shwari", category: "banking" },
  { number: "516516", name: "Zenka", category: "banking" },
  { number: "333444", name: "Okash", category: "banking" },
  { number: "777111", name: "Fuliza", category: "banking" },
  { number: "891300", name: "Hustler Fund", category: "banking" },
  { number: "820201", name: "Timiza", category: "banking" },
  { number: "303030", name: "Stanbic Bank", category: "banking" },
  { number: "329329", name: "Standard Chartered", category: "banking" },
  { number: "986980", name: "DTB Bank", category: "banking" },
  { number: "516600", name: "DTB Bank", category: "banking" },
  { number: "100200", name: "Family Bank", category: "banking" },
  { number: "542542", name: "I&M Bank", category: "banking" },
  { number: "775566", name: "ABSA Bank", category: "banking" },
  { number: "247365", name: "Faulu Microfinance", category: "banking" },
  { number: "101010", name: "iPesa", category: "banking" },
  { number: "506900", name: "Tower Sacco", category: "banking" },
  { number: "400400", name: "CBA Loop", category: "banking" },
  { number: "3033815", name: "LOOP B2C", category: "banking" },

  // === INSURANCE & SAVINGS ===
  { number: "777777", name: "Britam Insurance", category: "insurance" },
  { number: "827142", name: "Britam Life Assurance", category: "insurance" },
  { number: "300300", name: "Britam Asset Managers", category: "insurance" },
  { number: "432432", name: "Jubilee Insurance", category: "insurance" },
  { number: "200500", name: "AAR Insurance", category: "insurance" },
  { number: "510600", name: "ICEA Lion", category: "insurance" },
  { number: "636363", name: "CIC Insurance", category: "insurance" },
  { number: "878700", name: "Madison Insurance", category: "insurance" },
  { number: "624624", name: "Resolution Insurance", category: "insurance" },
  { number: "200600", name: "UAP Old Mutual", category: "insurance" },
  { number: "200333", name: "NSSF", category: "insurance" },
  { number: "888999", name: "Money Market Fund", category: "insurance" },
  { number: "777888", name: "Old Mutual", category: "insurance" },
  { number: "400600", name: "Sanlam Investments", category: "insurance" },
  { number: "100600", name: "ICEA Lion Asset Management", category: "insurance" },

  // === TRANSPORT ===
  { number: "820200", name: "SGR Madaraka Express", category: "transport" },
  { number: "222111", name: "Kenya Airways", category: "transport" },
  { number: "264264", name: "Jambojet", category: "transport" },
  { number: "828282", name: "Easy Coach", category: "transport" },
  { number: "910900", name: "Modern Coast", category: "transport" },
  { number: "515151", name: "Guardian/Dreamliner", category: "transport" },
  { number: "174379", name: "Uber", category: "transport" },
  { number: "893000", name: "Bolt", category: "transport" },
  { number: "220055", name: "Little Ride", category: "transport" },
  { number: "808100", name: "Faras", category: "transport" },
  { number: "808080", name: "Moja Expressway", category: "transport" },
  { number: "808101", name: "Nairobi Parking", category: "transport" },

  // === FOOD & DINING ===
  { number: "525900", name: "Jumia Food", category: "food_dining" },
  { number: "000725", name: "Glovo", category: "food_dining" },
  { number: "893893", name: "Bolt Food", category: "food_dining" },
  { number: "424242", name: "Uber Eats", category: "food_dining" },

  // === SUBSCRIPTIONS ===
  { number: "555000", name: "Netflix", category: "subscriptions" },
  { number: "556677", name: "Spotify", category: "subscriptions" },
  { number: "700900", name: "Apple Services", category: "subscriptions" },
  { number: "800900", name: "Google Services", category: "subscriptions" },
  { number: "333555", name: "DSTV / MultiChoice", category: "subscriptions" },
  { number: "711711", name: "GOtv", category: "subscriptions" },
  { number: "708090", name: "Showmax", category: "subscriptions" },
  { number: "222222", name: "StarTimes", category: "subscriptions" },

  // === SHOPPING ===
  { number: "525901", name: "Jumia", category: "shopping" },
  { number: "323232", name: "Sendy", category: "shopping" },
  { number: "510800", name: "iPay", category: "shopping", description: "Payment aggregator (merchant unknown)" },
  { number: "220333", name: "Pesapal", category: "shopping", description: "Payment gateway (merchant unknown)" },

  // === DOMESTIC SERVICES (placeholders — most domestic-services are P2P) ===
  // (Domestic & Personal Services usually flows through phone numbers, not paybills.)

  // === GLOBALPAY (special — handled by Layer 2 in classify.ts) ===
  { number: "903470", name: "M-PESA GlobalPay", category: "subscriptions", description: "Card-on-file gateway — see GlobalPay merchants" },

  // === INTERNATIONAL REMITTANCE (treated as inflow income, not spending) ===
  { number: "4133831", name: "Remitly", category: "personal", description: "International money transfer" },
  { number: "785788", name: "DIGITAL IMTS (MobeeBank)", category: "personal" },
  { number: "4020383", name: "Equity Bank IMT", category: "personal" },

  // === EDUCATION (filed under government & taxes per the consolidated taxonomy) ===
  { number: "762762", name: "University of Nairobi", category: "government" },
  { number: "820305", name: "Kenyatta University", category: "government" },
  { number: "695869", name: "JKUAT", category: "government" },
  { number: "304304", name: "Moi University", category: "government" },
  { number: "891100", name: "Strathmore University", category: "government" },
  { number: "163163", name: "USIU Africa", category: "government" },
  { number: "600100", name: "KCA University", category: "government" },
  { number: "909090", name: "Daystar University", category: "government" },
  { number: "247000", name: "Mount Kenya University", category: "government" },
  { number: "811811", name: "Zetech University", category: "government" },
  { number: "700700", name: "HELB", category: "government" },
];

/**
 * Common Kenyan tills (Buy Goods). Heavily skewed toward groceries, dining, fuel.
 */
const TILL_REGISTRY: TillEntry[] = [
  // === GROCERIES ===
  { number: "000001", name: "Naivas Supermarket", category: "groceries" },
  { number: "555111", name: "Naivas Supermarket", category: "groceries" },
  { number: "389389", name: "Naivas (Westlands)", category: "groceries" },
  { number: "470740", name: "Carrefour", category: "groceries" },
  { number: "444111", name: "Carrefour Supermarket", category: "groceries" },
  { number: "600222", name: "Carrefour (Hub)", category: "groceries" },
  { number: "550550", name: "Quickmart", category: "groceries" },
  { number: "551551", name: "Quickmart Supermarket", category: "groceries" },
  { number: "234234", name: "Chandarana Foodplus", category: "groceries" },
  { number: "111222", name: "Cleanshelf", category: "groceries" },
  { number: "788788", name: "Tusky's (Legacy)", category: "groceries" },
  { number: "123456", name: "Greenmart", category: "groceries" },
  { number: "345345", name: "Zucchini Greengrocers", category: "groceries" },
  { number: "901901", name: "Souk Deli", category: "groceries" },
  { number: "778899", name: "Karen Provision Store", category: "groceries" },
  { number: "880011", name: "Fresh On The Go", category: "groceries" },
  { number: "112323", name: "Greenspoon", category: "groceries" },

  // === FOOD & DINING ===
  { number: "222333", name: "Java House", category: "food_dining" },
  { number: "989898", name: "Java House", category: "food_dining" },
  { number: "333447", name: "Artcaffe", category: "food_dining" },
  { number: "878799", name: "Artcaffe", category: "food_dining" },
  { number: "400500", name: "CJ's Restaurant", category: "food_dining" },
  { number: "545454", name: "KFC Kenya", category: "food_dining" },
  { number: "656565", name: "Subway Kenya", category: "food_dining" },
  { number: "767676", name: "Pizza Inn", category: "food_dining" },
  { number: "100300", name: "Big Square", category: "food_dining" },
  { number: "808081", name: "Burger King Kenya", category: "food_dining" },
  { number: "898989", name: "Domino's Pizza", category: "food_dining" },
  { number: "123789", name: "Chicken Inn", category: "food_dining" },
  { number: "456123", name: "Ocean Basket", category: "food_dining" },
  { number: "789456", name: "Spur Restaurant", category: "food_dining" },
  { number: "567567", name: "The Talisman", category: "food_dining" },
  { number: "112233", name: "Inti Restaurant", category: "food_dining" },
  { number: "445566", name: "Brew Bistro", category: "food_dining" },
  { number: "998877", name: "Mama Oliech", category: "food_dining" },
  { number: "667788", name: "About Thyme", category: "food_dining" },
  { number: "334455", name: "Boho Eatery", category: "food_dining" },
  { number: "556678", name: "Tin Roof Cafe", category: "food_dining" },
  { number: "889900", name: "Cafe Deli", category: "food_dining" },
  { number: "224422", name: "Sand Trap", category: "food_dining" },

  // === TRANSPORT (fuel) ===
  { number: "100200", name: "Uber Kenya", category: "transport" },
  { number: "200100", name: "Bolt Kenya", category: "transport" },
  { number: "300400", name: "Little Cab", category: "transport" },
  { number: "456789", name: "Shell Petrol Station", category: "transport" },
  { number: "654321", name: "Total Energies", category: "transport" },
  { number: "777333", name: "Rubis Energy", category: "transport" },
  { number: "888222", name: "National Oil", category: "transport" },

  // === SHOPPING / ENTERTAINMENT ===
  { number: "999111", name: "IMAX Kenya", category: "shopping" },
  { number: "121212", name: "Century Cinemax", category: "shopping" },
  { number: "343434", name: "Nairobi Cinema", category: "shopping" },
  { number: "565656", name: "Village Market", category: "shopping" },

  // === HEALTHCARE ===
  { number: "400800", name: "Goodlife Pharmacy", category: "healthcare" },
  { number: "500900", name: "Haltons Pharmacy", category: "healthcare" },
  { number: "600700", name: "Pharmart Pharmacy", category: "healthcare" },

  // === DOMESTIC & PERSONAL SERVICES ===
  { number: "700800", name: "Smart Gyms", category: "domestic_services" },
  { number: "800700", name: "Ignite Fitness", category: "domestic_services" },
  { number: "900600", name: "Body by Sawa", category: "domestic_services" },
];

// Build lookup maps for O(1) access
const paybillMap = new Map<string, PaybillEntry>();
for (const entry of PAYBILL_REGISTRY) {
  // First entry for a number wins; later duplicates skipped (registry hygiene).
  if (!paybillMap.has(entry.number)) {
    paybillMap.set(entry.number, entry);
  }
}

const tillMap = new Map<string, TillEntry>();
for (const entry of TILL_REGISTRY) {
  if (!tillMap.has(entry.number)) {
    tillMap.set(entry.number, entry);
  }
}

const nameToPaybill = new Map<string, PaybillEntry>();
for (const entry of PAYBILL_REGISTRY) {
  nameToPaybill.set(entry.name.toUpperCase(), entry);
}

const nameToTill = new Map<string, TillEntry>();
for (const entry of TILL_REGISTRY) {
  nameToTill.set(entry.name.toUpperCase(), entry);
}

export function lookupPaybill(number: string): PaybillEntry | null {
  return paybillMap.get(number) ?? null;
}

export function lookupTill(number: string): TillEntry | null {
  return tillMap.get(number) ?? null;
}

export function lookupByName(name: string): { type: "paybill" | "till"; entry: PaybillEntry | TillEntry } | null {
  const upper = name.toUpperCase();
  const paybill = nameToPaybill.get(upper);
  if (paybill) return { type: "paybill", entry: paybill };
  const till = nameToTill.get(upper);
  if (till) return { type: "till", entry: till };

  // Fuzzy match
  for (const [key, entry] of nameToPaybill) {
    if (upper.includes(key) || key.includes(upper)) {
      return { type: "paybill", entry };
    }
  }
  for (const [key, entry] of nameToTill) {
    if (upper.includes(key) || key.includes(upper)) {
      return { type: "till", entry };
    }
  }

  return null;
}

export function getCategoryForPaybill(number: string): Category | null {
  const entry = paybillMap.get(number);
  return entry?.category ?? null;
}

export function getCategoryForTill(number: string): Category | null {
  const entry = tillMap.get(number);
  return entry?.category ?? null;
}

export function getAllPaybills(): PaybillEntry[] {
  return PAYBILL_REGISTRY;
}

export function getAllTills(): TillEntry[] {
  return TILL_REGISTRY;
}
