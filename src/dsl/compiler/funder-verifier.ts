import { buildNumericRegexes, buildEntityNameRegex } from "./deterministic-verifier";
import { normalizeTextForMatching } from "./source-corpus";

export interface GroundedVerificationItem {
  field: string;
  value: any;
  status: "VERIFIED" | "UNVERIFIED" | "ABSENT";
  evidenceSnippet?: string;
  sourceUrl?: string;
}

export interface FunderGroundingReport {
  entityName: string;
  verifiedCount: number;
  unverifiedCount: number;
  items: GroundedVerificationItem[];
  groundingScorePct: number;
}

/**
 * Checks whether an array of numeric regexes matches anywhere in the corpus text.
 */
function verifyNumeric(num: number | null | undefined, text: string): { verified: boolean; snippet?: string } {
  if (num == null) return { verified: true };
  const regexes = buildNumericRegexes(num);
  for (const r of regexes) {
    const match = text.match(r);
    if (match) {
      const idx = match.index ?? 0;
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + match[0].length + 40);
      return { verified: true, snippet: text.slice(start, end).replace(/\s+/g, " ").trim() };
    }
  }
  return { verified: false };
}

/**
 * Checks whether a text token or entity name matches in the corpus text.
 */
function verifyText(term: string | null | undefined, text: string): { verified: boolean; snippet?: string } {
  if (!term || term.trim().length === 0) return { verified: true };
  const cleanTerm = term.trim();
  // Try entity name regex first
  const entityRegex = buildEntityNameRegex(cleanTerm);
  const entityMatch = text.match(entityRegex);
  if (entityMatch) {
    const idx = entityMatch.index ?? 0;
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + entityMatch[0].length + 40);
    return { verified: true, snippet: text.slice(start, end).replace(/\s+/g, " ").trim() };
  }

  // Fallback to substring match
  const normTerm = normalizeTextForMatching(cleanTerm);
  const normText = normalizeTextForMatching(text);
  if (normText.includes(normTerm)) {
    const idx = normText.indexOf(normTerm);
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + normTerm.length + 40);
    return { verified: true, snippet: text.slice(start, end).replace(/\s+/g, " ").trim() };
  }

  return { verified: false };
}

/**
 * Verifies all extracted fields of an Invoice Provider against its cited web page texts.
 */
export function verifyProviderExtractionGrounding(provider: any, pageTexts: string[]): FunderGroundingReport {
  const fullCorpus = pageTexts.join("\n\n");
  const items: GroundedVerificationItem[] = [];

  // 1. Entity Name
  const entityRes = verifyText(provider.name, fullCorpus);
  items.push({
    field: "name",
    value: provider.name,
    status: entityRes.verified ? "VERIFIED" : "UNVERIFIED",
    evidenceSnippet: entityRes.snippet,
  });

  // 2. Ticket Bounds
  if (provider.minTicketUsd != null) {
    const minRes = verifyNumeric(provider.minTicketUsd, fullCorpus);
    items.push({
      field: "minTicketUsd",
      value: provider.minTicketUsd,
      status: minRes.verified ? "VERIFIED" : "UNVERIFIED",
      evidenceSnippet: minRes.snippet,
    });
  }
  if (provider.maxTicketUsd != null) {
    const maxRes = verifyNumeric(provider.maxTicketUsd, fullCorpus);
    items.push({
      field: "maxTicketUsd",
      value: provider.maxTicketUsd,
      status: maxRes.verified ? "VERIFIED" : "UNVERIFIED",
      evidenceSnippet: maxRes.snippet,
    });
  }

  // 3. Jurisdictions
  const jurisdictions: string[] = [
    ...(provider.sellerJurisdictions ?? []),
    ...(provider.obligorJurisdictions ?? []),
  ].filter((j) => j && j.toLowerCase() !== "any");

  for (const jur of Array.from(new Set(jurisdictions))) {
    const jurRes = verifyText(jur, fullCorpus);
    items.push({
      field: `jurisdiction:${jur}`,
      value: jur,
      status: jurRes.verified ? "VERIFIED" : "UNVERIFIED",
      evidenceSnippet: jurRes.snippet,
    });
  }

  // 4. Required Documents
  if (Array.isArray(provider.documentsRequired)) {
    for (const doc of provider.documentsRequired) {
      const docLabel = (doc.note || doc.code || "").replace(/_/g, " ");
      const docRes = verifyText(docLabel, fullCorpus);
      items.push({
        field: `documentRequired:${doc.code}`,
        value: docLabel,
        status: docRes.verified ? "VERIFIED" : "UNVERIFIED",
        evidenceSnippet: docRes.snippet,
      });
    }
  }

  const verifiedCount = items.filter((i) => i.status === "VERIFIED").length;
  const unverifiedCount = items.filter((i) => i.status === "UNVERIFIED").length;
  const total = items.length;
  const groundingScorePct = total > 0 ? Math.round((verifiedCount / total) * 100) : 100;

  return {
    entityName: provider.name,
    verifiedCount,
    unverifiedCount,
    items,
    groundingScorePct,
  };
}

/**
 * Verifies all extracted fields of a Trade Funder against its cited web page texts.
 */
export function verifyTradeFunderExtractionGrounding(funder: any, pageTexts: string[]): FunderGroundingReport {
  const fullCorpus = pageTexts.join("\n\n");
  const items: GroundedVerificationItem[] = [];

  // 1. Entity Name
  const entityRes = verifyText(funder.name, fullCorpus);
  items.push({
    field: "name",
    value: funder.name,
    status: entityRes.verified ? "VERIFIED" : "UNVERIFIED",
    evidenceSnippet: entityRes.snippet,
  });

  // 2. Ticket Bounds
  if (funder.minTicketUsd != null) {
    const minRes = verifyNumeric(funder.minTicketUsd, fullCorpus);
    items.push({
      field: "minTicketUsd",
      value: funder.minTicketUsd,
      status: minRes.verified ? "VERIFIED" : "UNVERIFIED",
      evidenceSnippet: minRes.snippet,
    });
  }
  if (funder.maxTicketUsd != null) {
    const maxRes = verifyNumeric(funder.maxTicketUsd, fullCorpus);
    items.push({
      field: "maxTicketUsd",
      value: funder.maxTicketUsd,
      status: maxRes.verified ? "VERIFIED" : "UNVERIFIED",
      evidenceSnippet: maxRes.snippet,
    });
  }

  // 3. Supported Commodities
  if (Array.isArray(funder.supportedCommodities)) {
    for (const comm of funder.supportedCommodities) {
      const commRes = verifyText(comm, fullCorpus);
      items.push({
        field: `commodity:${comm}`,
        value: comm,
        status: commRes.verified ? "VERIFIED" : "UNVERIFIED",
        evidenceSnippet: commRes.snippet,
      });
    }
  }

  // 4. Jurisdictions
  const jurisdictions: string[] = [
    ...(funder.acceptedSupplierJurisdictions ?? []),
    ...(funder.acceptedTraderJurisdictions ?? []),
    ...(funder.acceptedBuyerJurisdictions ?? []),
  ].filter((j) => j && j.toLowerCase() !== "any" && j.toLowerCase() !== "global");

  for (const jur of Array.from(new Set(jurisdictions))) {
    const jurRes = verifyText(jur, fullCorpus);
    items.push({
      field: `jurisdiction:${jur}`,
      value: jur,
      status: jurRes.verified ? "VERIFIED" : "UNVERIFIED",
      evidenceSnippet: jurRes.snippet,
    });
  }

  // 5. Documents Required
  if (Array.isArray(funder.documentsRequired)) {
    for (const doc of funder.documentsRequired) {
      const docLabel = (doc.note || doc.code || "").replace(/_/g, " ");
      const docRes = verifyText(docLabel, fullCorpus);
      items.push({
        field: `documentRequired:${doc.code}`,
        value: docLabel,
        status: docRes.verified ? "VERIFIED" : "UNVERIFIED",
        evidenceSnippet: docRes.snippet,
      });
    }
  }

  const verifiedCount = items.filter((i) => i.status === "VERIFIED").length;
  const unverifiedCount = items.filter((i) => i.status === "UNVERIFIED").length;
  const total = items.length;
  const groundingScorePct = total > 0 ? Math.round((verifiedCount / total) * 100) : 100;

  return {
    entityName: funder.name,
    verifiedCount,
    unverifiedCount,
    items,
    groundingScorePct,
  };
}

/**
 * Verifies all extracted fields of a Startup Investor against its cited web page texts.
 */
export function verifyStartupInvestorExtractionGrounding(investor: any, pageTexts: string[]): FunderGroundingReport {
  const fullCorpus = pageTexts.join("\n\n");
  const items: GroundedVerificationItem[] = [];

  // 1. Entity Name
  const entityRes = verifyText(investor.name, fullCorpus);
  items.push({
    field: "name",
    value: investor.name,
    status: entityRes.verified ? "VERIFIED" : "UNVERIFIED",
    evidenceSnippet: entityRes.snippet,
  });

  // 2. Check Sizes
  if (investor.minCheckUsd != null) {
    const minRes = verifyNumeric(investor.minCheckUsd, fullCorpus);
    items.push({
      field: "minCheckUsd",
      value: investor.minCheckUsd,
      status: minRes.verified ? "VERIFIED" : "UNVERIFIED",
      evidenceSnippet: minRes.snippet,
    });
  }
  if (investor.maxCheckUsd != null) {
    const maxRes = verifyNumeric(investor.maxCheckUsd, fullCorpus);
    items.push({
      field: "maxCheckUsd",
      value: investor.maxCheckUsd,
      status: maxRes.verified ? "VERIFIED" : "UNVERIFIED",
      evidenceSnippet: maxRes.snippet,
    });
  }

  // 3. Key Contacts / People
  if (Array.isArray(investor.keyContacts)) {
    for (const contact of investor.keyContacts) {
      if (!contact.name) continue;
      const contactRes = verifyText(contact.name, fullCorpus);
      items.push({
        field: `keyContact:${contact.name}`,
        value: `${contact.name} (${contact.role || "Partner"})`,
        status: contactRes.verified ? "VERIFIED" : "UNVERIFIED",
        evidenceSnippet: contactRes.snippet,
      });
    }
  }

  // 4. Portfolio Companies
  if (Array.isArray(investor.portfolioCompanies)) {
    for (const portco of investor.portfolioCompanies) {
      const portcoRes = verifyText(portco, fullCorpus);
      items.push({
        field: `portfolioCompany:${portco}`,
        value: portco,
        status: portcoRes.verified ? "VERIFIED" : "UNVERIFIED",
        evidenceSnippet: portcoRes.snippet,
      });
    }
  }

  // 5. Accepted Jurisdictions
  if (Array.isArray(investor.acceptedJurisdictions)) {
    for (const jur of investor.acceptedJurisdictions) {
      const jurRes = verifyText(jur, fullCorpus);
      items.push({
        field: `jurisdiction:${jur}`,
        value: jur,
        status: jurRes.verified ? "VERIFIED" : "UNVERIFIED",
        evidenceSnippet: jurRes.snippet,
      });
    }
  }

  // 6. Documents Required
  if (Array.isArray(investor.documentsRequired)) {
    for (const doc of investor.documentsRequired) {
      const docLabel = (doc.note || doc.code || "").replace(/_/g, " ");
      const docRes = verifyText(docLabel, fullCorpus);
      items.push({
        field: `documentRequired:${doc.code}`,
        value: docLabel,
        status: docRes.verified ? "VERIFIED" : "UNVERIFIED",
        evidenceSnippet: docRes.snippet,
      });
    }
  }

  const verifiedCount = items.filter((i) => i.status === "VERIFIED").length;
  const unverifiedCount = items.filter((i) => i.status === "UNVERIFIED").length;
  const total = items.length;
  const groundingScorePct = total > 0 ? Math.round((verifiedCount / total) * 100) : 100;

  return {
    entityName: investor.name,
    verifiedCount,
    unverifiedCount,
    items,
    groundingScorePct,
  };
}
