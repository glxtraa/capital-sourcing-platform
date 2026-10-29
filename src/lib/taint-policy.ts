import { db } from "@/lib/db";
import { DEFAULT_TAINT_POLICIES, type TaintPolicyEntry } from "@/dsl/provenance";

/**
 * Ensures the `DocumentTaintPolicy` table is seeded with default classifications
 * across all 3 asset classes ("INVOICE", "TRADE", "VC") and returns all rows.
 */
export async function getOrSeedTaintPolicies(assetClass?: "INVOICE" | "TRADE" | "VC") {
  const existingCount = await db.documentTaintPolicy.count();
  if (existingCount === 0) {
    await db.documentTaintPolicy.createMany({
      data: DEFAULT_TAINT_POLICIES.map((p) => ({
        assetClass: p.assetClass,
        taxonomyCode: p.taxonomyCode,
        label: p.label,
        defaultTaint: p.defaultTaint,
      })),
      skipDuplicates: true,
    });
  }

  return db.documentTaintPolicy.findMany({
    where: assetClass ? { assetClass } : undefined,
    orderBy: [{ assetClass: "asc" }, { taxonomyCode: "asc" }],
  });
}

/**
 * Builds a fast lookup map `{ [taxonomyCode]: "AUDITED_PROOF" | "UNVERIFIED_CLAIM" }`
 * from the database (falling back to DEFAULT_TAINT_POLICIES if DB is unreachable).
 */
export async function getTaintPolicyMap(
  assetClass?: "INVOICE" | "TRADE" | "VC",
): Promise<Record<string, "AUDITED_PROOF" | "UNVERIFIED_CLAIM">> {
  const map: Record<string, "AUDITED_PROOF" | "UNVERIFIED_CLAIM"> = {};
  for (const def of DEFAULT_TAINT_POLICIES) {
    if (!assetClass || def.assetClass === assetClass) {
      map[def.taxonomyCode] = def.defaultTaint;
    }
  }

  try {
    const rows = await getOrSeedTaintPolicies(assetClass);
    for (const r of rows) {
      map[r.taxonomyCode] =
        r.defaultTaint === "AUDITED_PROOF" ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM";
    }
  } catch {
    // Graceful fallback to defaults
  }

  return map;
}

export type { TaintPolicyEntry };
