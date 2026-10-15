export const VC_DOCUMENT_TAXONOMY = [
  "VC_PITCH_DECK",            // Pitch deck / presentation slides (PDF)
  "VC_ONE_PAGER",             // Executive summary / memo (PDF)
  "VC_CAP_TABLE",             // Detailed capitalization table (PDF / CSV / XLSX)
  "VC_FINANCIAL_MODEL",       // Historical & projected P&L, burn, revenue (XLSX / PDF)
  "VC_METRICS_DASHBOARD",     // Stripe / ChartMogul / Mixpanel traction metrics
  "VC_CUSTOMER_CONTRACT_LOI", // Key customer enterprise contracts or signed LOIs
  "VC_PRIOR_TERM_SHEET",      // Existing convertible notes, SAFEs, or term sheets
  "VC_CORP_CHARTER",          // Certificate of Incorporation (Delaware C-Corp, etc.)
  "VC_FOUNDER_RESUME_BIO",    // Founder LinkedIn / CV / background documentation
  "VC_PRODUCT_DEMO_SPEC",     // Technical whitepaper, architecture, or patent filing
] as const;

export type VCDocumentCode = (typeof VC_DOCUMENT_TAXONOMY)[number] | string;
