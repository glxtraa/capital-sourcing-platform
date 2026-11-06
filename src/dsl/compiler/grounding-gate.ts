/**
 * Strict DSL Grounding Gate.
 *
 * Deterministically checks structured agent extractions against cited source texts.
 * If extracted values (ticket numbers, documents, jurisdictions, portfolio entities, contacts)
 * fail grounding against the source text, the gate automatically sanitizes and prunes
 * the ungrounded claims BEFORE they can be written to the database.
 *
 * If core identification fails (e.g. entity name not even present on the cited pages),
 * the gate rejects the extraction entirely so hallucinations cannot enter the system.
 */

import {
  verifyProviderExtractionGrounding,
  verifyTradeFunderExtractionGrounding,
  verifyStartupInvestorExtractionGrounding,
  type FunderGroundingReport,
} from "./funder-verifier";
import type { ProviderDTO } from "../provider-schema";
import type { TradeFunderDTO } from "../trade/trade-funder-schema";
import type { StartupInvestorDTO } from "../vc/vc-investor-schema";

export interface GroundingGateResult<T> {
  passed: boolean;
  cleanData: T | null;
  report: FunderGroundingReport;
  error?: string;
}

const uniq = <T>(arr: T[] | undefined | null): T[] => Array.from(new Set(arr ?? []));

/**
 * DSL Grounding Gate for Invoice Factoring Providers (db.provider).
 */
export function gateInvoiceProvider(provider: ProviderDTO, pageTexts: string[]): GroundingGateResult<ProviderDTO> {
  const report = verifyProviderExtractionGrounding(provider, pageTexts);

  // Core Rule 1: Entity name must be grounded in the cited sources
  const nameItem = report.items.find((i) => i.field === "name");
  if (pageTexts.length > 0 && nameItem?.status === "UNVERIFIED") {
    return {
      passed: false,
      cleanData: null,
      report,
      error: `DSL Grounding Gate Rejected: Provider name "${provider.name}" was not found in any cited source pages.`,
    };
  }

  // Filter out any ungrounded jurisdictions
  const cleanSellerJur = (provider.sellerJurisdictions ?? []).filter((j) => {
    if (!j || j.toLowerCase() === "any") return true;
    const item = report.items.find((i) => i.field === `jurisdiction:${j}`);
    return !item || item.status === "VERIFIED";
  });
  const cleanObligorJur = (provider.obligorJurisdictions ?? []).filter((j) => {
    if (!j || j.toLowerCase() === "any") return true;
    const item = report.items.find((i) => i.field === `jurisdiction:${j}`);
    return !item || item.status === "VERIFIED";
  });

  // Filter out ungrounded document requirements
  const cleanDocs = (provider.documentsRequired ?? []).filter((d) => {
    const item = report.items.find((i) => i.field === `documentRequired:${d.code}`);
    return !item || item.status === "VERIFIED";
  });

  // Only retain numeric tickets if proven in source text
  const minTicketOk = report.items.find((i) => i.field === "minTicketUsd")?.status === "VERIFIED";
  const maxTicketOk = report.items.find((i) => i.field === "maxTicketUsd")?.status === "VERIFIED";

  const cleanData: ProviderDTO = {
    ...provider,
    sellerJurisdictions: cleanSellerJur.length > 0 ? uniq(cleanSellerJur) : provider.sellerJurisdictions,
    obligorJurisdictions: cleanObligorJur.length > 0 ? uniq(cleanObligorJur) : provider.obligorJurisdictions,
    documentsRequired: cleanDocs,
    minTicketUsd: minTicketOk ? provider.minTicketUsd : null,
    maxTicketUsd: maxTicketOk ? provider.maxTicketUsd : null,
    confidence: report.groundingScorePct >= 60 && pageTexts.length > 0 ? "VERIFIED_SITE" : "VERIFIED_SECONDARY",
  };

  return {
    passed: true,
    cleanData,
    report,
  };
}

/**
 * DSL Grounding Gate for Commodity Trade Funders (db.tradeFunder).
 */
export function gateTradeFunder(funder: TradeFunderDTO, pageTexts: string[]): GroundingGateResult<TradeFunderDTO> {
  const report = verifyTradeFunderExtractionGrounding(funder, pageTexts);

  const nameItem = report.items.find((i) => i.field === "name");
  if (pageTexts.length > 0 && nameItem?.status === "UNVERIFIED") {
    return {
      passed: false,
      cleanData: null,
      report,
      error: `DSL Grounding Gate Rejected: Funder name "${funder.name}" was not found in any cited source pages.`,
    };
  }

  const cleanCommodities = (funder.supportedCommodities ?? []).filter((c) => {
    const item = report.items.find((i) => i.field === `commodity:${c}`);
    return !item || item.status === "VERIFIED";
  });

  const cleanSupplierJur = (funder.acceptedSupplierJurisdictions ?? []).filter((j) => {
    const item = report.items.find((i) => i.field === `jurisdiction:${j}`);
    return !item || item.status === "VERIFIED";
  });
  const cleanTraderJur = (funder.acceptedTraderJurisdictions ?? []).filter((j) => {
    const item = report.items.find((i) => i.field === `jurisdiction:${j}`);
    return !item || item.status === "VERIFIED";
  });
  const cleanBuyerJur = (funder.acceptedBuyerJurisdictions ?? []).filter((j) => {
    const item = report.items.find((i) => i.field === `jurisdiction:${j}`);
    return !item || item.status === "VERIFIED";
  });

  const cleanDocs = (funder.documentsRequired ?? []).filter((d) => {
    const item = report.items.find((i) => i.field === `documentRequired:${d.code}`);
    return !item || item.status === "VERIFIED";
  });

  const minTicketOk = report.items.find((i) => i.field === "minTicketUsd")?.status === "VERIFIED";
  const maxTicketOk = report.items.find((i) => i.field === "maxTicketUsd")?.status === "VERIFIED";

  const cleanData: TradeFunderDTO = {
    ...funder,
    supportedCommodities: cleanCommodities.length > 0 ? uniq(cleanCommodities) : funder.supportedCommodities,
    acceptedSupplierJurisdictions: cleanSupplierJur.length > 0 ? uniq(cleanSupplierJur) : funder.acceptedSupplierJurisdictions,
    acceptedTraderJurisdictions: cleanTraderJur.length > 0 ? uniq(cleanTraderJur) : funder.acceptedTraderJurisdictions,
    acceptedBuyerJurisdictions: cleanBuyerJur.length > 0 ? uniq(cleanBuyerJur) : funder.acceptedBuyerJurisdictions,
    documentsRequired: cleanDocs,
    minTicketUsd: minTicketOk ? funder.minTicketUsd : null,
    maxTicketUsd: maxTicketOk ? funder.maxTicketUsd : null,
    confidence: report.groundingScorePct >= 60 && pageTexts.length > 0 ? "VERIFIED_SITE" : "VERIFIED_SECONDARY",
  };

  return {
    passed: true,
    cleanData,
    report,
  };
}

/**
 * DSL Grounding Gate for Startup VC Investors (db.startupInvestor).
 */
export function gateStartupInvestor(investor: StartupInvestorDTO, pageTexts: string[]): GroundingGateResult<StartupInvestorDTO> {
  const report = verifyStartupInvestorExtractionGrounding(investor, pageTexts);

  const nameItem = report.items.find((i) => i.field === "name");
  if (pageTexts.length > 0 && nameItem?.status === "UNVERIFIED") {
    return {
      passed: false,
      cleanData: null,
      report,
      error: `DSL Grounding Gate Rejected: Investor name "${investor.name}" was not found in any cited source pages.`,
    };
  }

  // Filter out ungrounded portfolio companies
  const cleanPortcos = (investor.portfolioCompanies ?? []).filter((p) => {
    const item = report.items.find((i) => i.field === `portfolioCompany:${p}`);
    return !item || item.status === "VERIFIED";
  });

  // Filter out ungrounded contacts / people
  const cleanContacts = (investor.keyContacts ?? []).filter((c) => {
    const item = report.items.find((i) => i.field === `keyContact:${c.name}`);
    return !item || item.status === "VERIFIED";
  });

  // Filter out ungrounded jurisdictions
  const cleanJur = (investor.acceptedJurisdictions ?? []).filter((j) => {
    const item = report.items.find((i) => i.field === `jurisdiction:${j}`);
    return !item || item.status === "VERIFIED";
  });

  const minCheckOk = report.items.find((i) => i.field === "minCheckUsd")?.status === "VERIFIED";
  const maxCheckOk = report.items.find((i) => i.field === "maxCheckUsd")?.status === "VERIFIED";

  const cleanData: StartupInvestorDTO = {
    ...investor,
    portfolioCompanies: cleanPortcos,
    keyContacts: cleanContacts,
    acceptedJurisdictions: cleanJur.length > 0 ? uniq(cleanJur) : investor.acceptedJurisdictions,
    minCheckUsd: minCheckOk ? investor.minCheckUsd : null,
    maxCheckUsd: maxCheckOk ? investor.maxCheckUsd : null,
    confidence: report.groundingScorePct >= 60 && pageTexts.length > 0 ? "VERIFIED_SITE" : "VERIFIED_SECONDARY",
  };

  return {
    passed: true,
    cleanData,
    report,
  };
}
