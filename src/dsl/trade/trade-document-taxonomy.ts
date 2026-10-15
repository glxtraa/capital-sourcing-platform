export const TRADE_DOCUMENT_TAXONOMY = [
  // 1. Core Commercial Contracts & Orders
  "TRADE_SUPPLY_CONTRACT",        // Buy contract (Supplier <-> Trader)
  "TRADE_OFFTAKE_CONTRACT",       // Sell contract (Trader <-> Buyer)
  "TRADE_PROFORMA_INVOICE",       // Proforma invoice for LC opening
  "TRADE_COMMERCIAL_INVOICE",     // Final commercial invoice
  "TRADE_PURCHASE_ORDER",         // Confirmed buyer Purchase Order (PO)

  // 2. Title, Shipping & Cold Chain
  "TRADE_OCEAN_BILL_OF_LADING",   // Clean on Board negotiable B/L (3/3 originals)
  "TRADE_CHARTER_PARTY_BL",       // Charter Party Bill of Lading
  "TRADE_SEA_WAYBILL",            // Non-negotiable Sea Waybill
  "TRADE_WAREHOUSE_RECEIPT",      // Negotiable Warehouse Warrant / Tank Receipt
  "TRADE_NOTICE_OF_READINESS",    // Vessel Master Notice of Readiness (NOR)
  "TRADE_REEFER_TEMP_LOG",        // Continuous reefer container temperature log (Corridor C)
  "TRADE_COLD_STORAGE_RECEIPT",   // Blast freezing & cold store holding receipt (Corridor C)

  // 3. Inspection, Assays & Quality
  "TRADE_CERT_QUALITY_ANALYSIS",  // Certificate of Sampling & Analysis (COA)
  "TRADE_DRAFT_SURVEY",           // Barge / Vessel draft displacement survey
  "TRADE_INDEPENDENT_SURVEYOR",   // Full inspection report (SGS, Intertek, Saybolt)
  "TRADE_LHV_SURVEYOR_REPORT",    // Laporan Surveyor (Mandatory Indonesian coal export)
  "TRADE_SEAFOOD_GRADING_SHEET",  // Count/size grading, glaze % & sensory analysis (Corridor C)

  // 4. Regulatory, Concession & Sanitary Permits
  "TRADE_MINING_IUP_CONCESSION",  // Primary mining concession (IUP-OP, Corridor A)
  "TRADE_TRANSPORT_SALE_PERMIT",  // Intermediary trading permit (IUP-OPK, Corridor A)
  "TRADE_SIMPONI_ROYALTY_RECEIPT",// Ministry of Energy & Mineral Resources royalty receipt (Corridor A)
  "TRADE_EXPORT_DECLARATION",     // Customs export filing (PEB / DUA)
  "TRADE_CERT_OF_ORIGIN",         // Form D, Form E, or Chamber COO
  "TRADE_PHYTOSANITARY_CERT",     // Plant health cert for agri bulk (Corridor B)
  "TRADE_RSPO_ISPO_CERT",         // Palm oil sustainable certification (Corridor B)
  "TRADE_SANIPES_HEALTH_CERT",    // Peruvian National Fisheries Health cert (Corridor C)
  "TRADE_INP_HEALTH_CERT",        // Ecuadorian Fisheries Institute sanitary cert (Corridor C)
  "TRADE_SERNAPESCA_CERT",        // Chilean National Fisheries Service cert (Corridor C)

  // 5. Banking, Payment & Security
  "TRADE_LC_MT700",               // Commercial Letter of Credit (MT700)
  "TRADE_LC_AMENDMENT_MT707",     // LC Amendment
  "TRADE_STANDBY_LC_MT760",       // Standby Letter of Credit / SBLC
  "TRADE_BANK_GUARANTEE_APG",     // Advance Payment Guarantee
  "TRADE_BILL_OF_EXCHANGE",       // Draft / Bill of Exchange under URC 522
  "TRADE_ESCROW_AGREEMENT",       // Pledged collection account deed

  // 6. Insurance & Corporate KYC
  "TRADE_MARINE_CARGO_INSURANCE", // Cargo Insurance Policy (Institute Cargo Clauses A)
  "TRADE_LOSS_PAYEE_ENDORSEMENT", // Bank endorsement on insurance policy
  "CORP_INCORP",                  // Certificate of Incorporation
  "CORP_STRUCTURE_UBO",           // Shareholding & UBO chart
  "FIN_AUDITED_STATEMENTS"        // 2-3 years audited financial statements
] as const;

export type TradeDocumentCode = (typeof TRADE_DOCUMENT_TAXONOMY)[number] | string;
