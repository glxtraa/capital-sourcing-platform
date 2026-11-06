import type { TradeDealSpec, TradeDocumentExtraction } from "@/dsl/trade";

export interface ProvenanceItem {
  id: string;
  field: string;
  category: "PARTY" | "CONTRACT_LEG" | "COMMODITY" | "AUDIT" | "RISK";
  value: string;
  sourceDocument: string | null;
  extractedAt: string | null;
  modelUsed: string | null;
  ocrEngineUsed?: string | null;
}

/**
 * Extracts and maps all source provenance data across a TradeDealSpec and its raw extractions.
 */
export function buildDealProvenanceList(
  spec: TradeDealSpec | null,
  extractions: TradeDocumentExtraction[] = [],
): ProvenanceItem[] {
  const items: ProvenanceItem[] = [];

  if (!spec) return items;

  // Supplier
  items.push({
    id: "supplier-profile",
    field: "Supplier Legal Identity & Jurisdiction",
    category: "PARTY",
    value: `${spec.supplier.legalName} (${spec.supplier.jurisdiction})`,
    sourceDocument: spec.supplier.sourceDocument ?? "Supply Contract",
    extractedAt: spec.supplier.extractionTimestamp ?? null,
    modelUsed: spec.supplier.modelUsed ?? "google/gemini-2.5-flash",
  });

  // Trader
  items.push({
    id: "trader-profile",
    field: "Trader Legal Identity & Jurisdiction",
    category: "PARTY",
    value: `${spec.trader.legalName} (${spec.trader.jurisdiction})`,
    sourceDocument: spec.trader.sourceDocument ?? "Supply Contract / Offtake Contract",
    extractedAt: spec.trader.extractionTimestamp ?? null,
    modelUsed: spec.trader.modelUsed ?? "google/gemini-2.5-flash",
  });

  // Buyer
  items.push({
    id: "buyer-profile",
    field: "Offtaker / Buyer Legal Identity & Jurisdiction",
    category: "PARTY",
    value: `${spec.buyer.legalName} (${spec.buyer.jurisdiction})`,
    sourceDocument: spec.buyer.sourceDocument ?? "Offtake Sales Contract",
    extractedAt: spec.buyer.extractionTimestamp ?? null,
    modelUsed: spec.buyer.modelUsed ?? "google/gemini-2.5-flash",
  });

  // Supply Contract
  items.push({
    id: "supply-contract",
    field: "Supply Leg Value & Commercial Terms",
    category: "CONTRACT_LEG",
    value: `$${spec.supplyContract.contractAmountUsd.toLocaleString()} USD | ${spec.supplyContract.incoterm} at ${spec.supplyContract.port} (${spec.supplyContract.paymentType})`,
    sourceDocument: spec.supplyContract.sourceDocument ?? "Supply Contract",
    extractedAt: spec.supplyContract.extractionTimestamp ?? null,
    modelUsed: spec.supplyContract.modelUsed ?? "google/gemini-2.5-flash",
  });

  // Offtake Contract
  items.push({
    id: "offtake-contract",
    field: "Offtake Leg Value & Commercial Terms",
    category: "CONTRACT_LEG",
    value: `$${spec.offtakeContract.contractAmountUsd.toLocaleString()} USD | ${spec.offtakeContract.incoterm} at ${spec.offtakeContract.port} (${spec.offtakeContract.paymentType}, tenor ${spec.offtakeContract.tenorDays}d)`,
    sourceDocument: spec.offtakeContract.sourceDocument ?? "Offtake Sales Contract",
    extractedAt: spec.offtakeContract.extractionTimestamp ?? null,
    modelUsed: spec.offtakeContract.modelUsed ?? "google/gemini-2.5-flash",
  });

  // Commodity Specs
  items.push({
    id: "commodity-specs",
    field: "Commodity Volume & Assay Parameters",
    category: "COMMODITY",
    value: `${spec.commodity.contractQuantity.toLocaleString()} ${spec.commodity.unit} ${spec.commodity.name}`,
    sourceDocument: spec.supplyContract.sourceDocument ?? "Contract / Inspection Survey",
    extractedAt: spec.supplyContract.extractionTimestamp ?? null,
    modelUsed: spec.supplyContract.modelUsed ?? "google/gemini-2.5-flash",
  });

  // Reconciliation Audit & Cashflow Gap
  items.push({
    id: "cashflow-gap",
    field: "Cashflow Gap Analysis & Trader Margin",
    category: "AUDIT",
    value: `Gap: ${spec.reconciliationAudit.cashflowGapDays} days | Gross Margin: $${spec.reconciliationAudit.grossMarginUsd.toLocaleString()} (${spec.reconciliationAudit.grossMarginPct.toFixed(1)}%)`,
    sourceDocument: "Deterministic Multi-Leg Reconciliation Engine",
    extractedAt: spec.supplyContract.extractionTimestamp ?? new Date().toISOString(),
    modelUsed: "Deterministic Rule Formula (Zero LLM Variance)",
  });

  // Risk flags
  spec.riskFlags.forEach((flag, index) => {
    items.push({
      id: `risk-flag-${index}`,
      field: `Risk Flag: ${flag.category.replace(/_/g, " ")}`,
      category: "RISK",
      value: `[Severity ${flag.severity}/5] ${flag.description}`,
      sourceDocument: "Cross-Contract Corroboration Engine",
      extractedAt: new Date().toISOString(),
      modelUsed: "Multi-Document Cross Check",
    });
  });

  return items;
}
