import { z } from "zod";

/**
 * Standard Venture Capital legal jurisdictions recognized globally.
 * These represent the primary corporate holding company structures accepted by
 * institutional venture capital funds, cross-border syndicates, and angel platforms.
 */
export const VC_STANDARD_JURISDICTIONS = [
  "Delaware (US)",
  "United Kingdom",
  "Singapore",
  "Cayman Islands",
  "Canada",
  "Germany",
  "France",
  "Netherlands",
  "Switzerland",
  "Ireland",
  "Israel",
  "Australia",
  "India",
  "UAE (ADGM / DIFC)",
  "Any / Global",
] as const;

export type VCStandardJurisdiction = (typeof VC_STANDARD_JURISDICTIONS)[number];

export interface JurisdictionDetail {
  id: string;
  name: VCStandardJurisdiction;
  corporateForm: string;
  standardInstrument: string;
  region: "AMER" | "EMEA" | "APAC" | "GLOBAL";
  aliases: string[];
  notes: string;
}

export const VC_JURISDICTION_TAXONOMY: JurisdictionDetail[] = [
  {
    id: "us-delaware",
    name: "Delaware (US)",
    corporateForm: "Delaware C-Corporation",
    standardInstrument: "Post-Money SAFE (Y Combinator) / NVCA Series Seed",
    region: "AMER",
    aliases: ["delaware", "us", "usa", "united states", "c-corp", "california", "new york", "san francisco", "bay area"],
    notes: "The global venture gold standard. Universally accepted by US and international venture capital firms.",
  },
  {
    id: "uk",
    name: "United Kingdom",
    corporateForm: "UK Private Limited Company (Ltd)",
    standardInstrument: "Advanced Subscription Agreement (ASA) / BVCA Seed Equity",
    region: "EMEA",
    aliases: ["uk", "united kingdom", "england", "london", "great britain", "ltd"],
    notes: "Primary European venture hub. Eligible for UK tax relief schemes (SEIS/EIS) with BVCA documentation.",
  },
  {
    id: "singapore",
    name: "Singapore",
    corporateForm: "Singapore Private Company Limited by Shares (Pte. Ltd.)",
    standardInstrument: "VIMA (Venture Capital Investment Model Agreements) / SAFE",
    region: "APAC",
    aliases: ["singapore", "sg", "pte ltd", "southeast asia", "sea"],
    notes: "The premier cross-border holding jurisdiction for Southeast Asia and Indo-Pacific ventures.",
  },
  {
    id: "cayman",
    name: "Cayman Islands",
    corporateForm: "Cayman Islands Exempted Company",
    standardInstrument: "Cayman SAFE / Series Seed Preferred Equity",
    region: "GLOBAL",
    aliases: ["cayman", "cayman islands", "exempted company", "offshore"],
    notes: "Widely used for offshore cross-border holding companies, crypto/Web3 foundations, and Latin America/Asia flips.",
  },
  {
    id: "canada",
    name: "Canada",
    corporateForm: "Federal (CBCA) / Ontario / BC Corporation",
    standardInstrument: "Canadian SAFE / CVCA Model Agreements",
    region: "AMER",
    aliases: ["canada", "ca", "toronto", "ontario", "vancouver", "cbca"],
    notes: "Standard structure for Canadian founders, accepted by US and Canadian institutional funds.",
  },
  {
    id: "germany",
    name: "Germany",
    corporateForm: "Gesellschaft mit beschränkter Haftung (GmbH)",
    standardInstrument: "Convertible Loan Agreement (KFW/Venture) / Notarized Seed Equity",
    region: "EMEA",
    aliases: ["germany", "de", "deutschland", "berlin", "gmbh", "munich"],
    notes: "Requires German notary for equity transfers and cap table modifications.",
  },
  {
    id: "france",
    name: "France",
    corporateForm: "Société par Actions Simplifiée (SAS)",
    standardInstrument: "BSA-AIR (Accords d'Investissement Rapide) / BSPCE",
    region: "EMEA",
    aliases: ["france", "fr", "paris", "sas"],
    notes: "Standard French innovation structure; BSA-AIR functions analogously to the US SAFE.",
  },
  {
    id: "netherlands",
    name: "Netherlands",
    corporateForm: "Besloten Vennootschap (B.V.)",
    standardInstrument: "Dutch Convertible Note / Standard BVCA/NVCA adapted",
    region: "EMEA",
    aliases: ["netherlands", "nl", "holland", "amsterdam", "b.v.", "bv"],
    notes: "Frequently utilized as a European intermediate holding company structure.",
  },
  {
    id: "switzerland",
    name: "Switzerland",
    corporateForm: "Aktiengesellschaft (AG) / GmbH",
    standardInstrument: "Swiss Convertible Loan / SECA Model Agreements",
    region: "EMEA",
    aliases: ["switzerland", "ch", "swiss", "zurich", "geneva", "ag"],
    notes: "Premier jurisdiction for deeptech, biotech, and crypto foundations (Crypto Valley / Zug).",
  },
  {
    id: "ireland",
    name: "Ireland",
    corporateForm: "Private Company Limited by Shares (LTD)",
    standardInstrument: "Irish SAFE / Enterprise Ireland Seed Agreements",
    region: "EMEA",
    aliases: ["ireland", "ie", "dublin", "ltd"],
    notes: "Common European headquarters for tech companies due to favorable IP regime and Enterprise Ireland support.",
  },
  {
    id: "israel",
    name: "Israel",
    corporateForm: "Israeli Private Company (Ltd)",
    standardInstrument: "CLA (Convertible Loan Agreement) / SAFE (adapted)",
    region: "EMEA",
    aliases: ["israel", "il", "tel aviv", "startup nation"],
    notes: "Hub for cybersecurity and deep tech. Commonly flips into Delaware C-Corp for Series A/B.",
  },
  {
    id: "australia",
    name: "Australia",
    corporateForm: "Australian Proprietary Company (Pty Ltd)",
    standardInstrument: "Australian SAFE (Airtree/Square Peg model)",
    region: "APAC",
    aliases: ["australia", "au", "sydney", "melbourne", "pty ltd"],
    notes: "Standard vehicle for Australian and New Zealand ventures.",
  },
  {
    id: "india",
    name: "India",
    corporateForm: "Private Limited Company (Pvt. Ltd.)",
    standardInstrument: "CCPS (Compulsorily Convertible Preference Shares)",
    region: "APAC",
    aliases: ["india", "in", "bengaluru", "bangalore", "mumbai", "delhi", "pvt ltd"],
    notes: "Standard Indian domestic entity. Often utilizes Singapore or Delaware top-co for cross-border VC.",
  },
  {
    id: "uae",
    name: "UAE (ADGM / DIFC)",
    corporateForm: "ADGM / DIFC Private Company Limited by Shares",
    standardInstrument: "ADGM / DIFC SAFE / Common Law Equity",
    region: "EMEA",
    aliases: ["uae", "dubai", "abu dhabi", "adgm", "difc", "middle east", "mena"],
    notes: "English Common Law financial free zones in UAE, standard for MENA regional venture investments.",
  },
  {
    id: "any-global",
    name: "Any / Global",
    corporateForm: "Global / Cross-Border Flexible",
    standardInstrument: "SAFE or Local Market Instrument",
    region: "GLOBAL",
    aliases: ["any", "global", "all", "worldwide", "international"],
    notes: "Investor will invest in any legitimate corporate jurisdiction or assist with a flip.",
  },
];

/**
 * Zod schema validating a startup or investor legal entity jurisdiction.
 * Supports standard VC jurisdictions or arbitrary strings with clear documentation.
 */
export const StartupJurisdictionSchema = z
  .string()
  .describe(
    `Recognized standard VC jurisdictions: ${VC_STANDARD_JURISDICTIONS.join(", ")}. ` +
    `Defaults to 'Delaware (US)' for institutional US rounds or 'Any / Global' for borderless syndicates.`
  );
