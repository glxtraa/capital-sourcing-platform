/**
 * Universal Jurisdiction Normalization & Matching Engine.
 * 
 * Unifies jurisdiction matching across all three asset classes:
 * - Invoice Factoring (parties.BORROWER, parties.OBLIGOR, parties.SUPPLIER)
 * - Commodity Trade Finance (supplier, trader, buyer)
 * - Startup Venture Capital (legalEntityJurisdiction, investor.acceptedJurisdictions)
 *
 * Ensures canonical standards and regional aliases (e.g. "HK", "Hong Kong", "HongKong", "HKSAR")
 * are correctly resolved and equated.
 */

export interface JurisdictionTaxonomyEntry {
  canonical: string;
  aliases: string[];
}

export const UNIVERSAL_JURISDICTION_TAXONOMY: JurisdictionTaxonomyEntry[] = [
  {
    canonical: "Hong Kong",
    aliases: ["hong kong", "hk", "hongkong", "hksar", "greater bay area", "apac"],
  },
  {
    canonical: "Singapore",
    aliases: ["singapore", "sg", "pte ltd", "southeast asia", "sea"],
  },
  {
    canonical: "United Kingdom",
    aliases: ["united kingdom", "uk", "great britain", "gb", "england", "london", "ltd"],
  },
  {
    canonical: "United States",
    aliases: ["united states", "us", "usa", "delaware", "c-corp", "california", "new york", "san francisco", "bay area"],
  },
  {
    canonical: "Japan",
    aliases: ["japan", "jp", "tokyo", "kabushiki kaisha", "kk"],
  },
  {
    canonical: "China",
    aliases: ["china", "cn", "prc", "mainland china", "beijing", "shanghai", "shenzhen"],
  },
  {
    canonical: "Indonesia",
    aliases: ["indonesia", "id", "idn", "jakarta", "pt"],
  },
  {
    canonical: "Germany",
    aliases: ["germany", "de", "deutschland", "berlin", "munich", "gmbh"],
  },
  {
    canonical: "France",
    aliases: ["france", "fr", "paris", "sas"],
  },
  {
    canonical: "Netherlands",
    aliases: ["netherlands", "nl", "holland", "amsterdam", "b.v.", "bv"],
  },
  {
    canonical: "Switzerland",
    aliases: ["switzerland", "ch", "swiss", "zurich", "geneva", "ag"],
  },
  {
    canonical: "Cayman Islands",
    aliases: ["cayman islands", "cayman", "exempted company", "offshore"],
  },
  {
    canonical: "Canada",
    aliases: ["canada", "ca", "toronto", "ontario", "vancouver", "cbca"],
  },
  {
    canonical: "Australia",
    aliases: ["australia", "au", "sydney", "melbourne", "pty ltd"],
  },
  {
    canonical: "UAE",
    aliases: ["uae", "united arab emirates", "dubai", "abu dhabi", "adgm", "difc", "middle east", "mena"],
  },
  {
    canonical: "India",
    aliases: ["india", "in", "bengaluru", "bangalore", "mumbai", "delhi", "pvt ltd"],
  },
  {
    canonical: "Ireland",
    aliases: ["ireland", "ie", "dublin"],
  },
  {
    canonical: "Israel",
    aliases: ["israel", "il", "tel aviv"],
  },
  {
    canonical: "Vietnam",
    aliases: ["vietnam", "vn"],
  },
  {
    canonical: "Chile",
    aliases: ["chile", "cl", "santiago"],
  },
  {
    canonical: "Peru",
    aliases: ["peru", "pe", "lima"],
  },
  {
    canonical: "Ecuador",
    aliases: ["ecuador", "ec", "quito", "guayaquil"],
  },
  {
    canonical: "Brazil",
    aliases: ["brazil", "brasil", "br", "sao paulo"],
  },
];

/**
 * Normalizes a jurisdiction string to its canonical name if known,
 * or returns cleaned trimmed text.
 */
export function normalizeJurisdictionName(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw.toLowerCase().replace(/[_-]/g, " ").trim();
  if (!cleaned) return "";

  for (const entry of UNIVERSAL_JURISDICTION_TAXONOMY) {
    if (entry.canonical.toLowerCase() === cleaned) return entry.canonical;
    if (entry.aliases.some((a) => a === cleaned || cleaned.includes(a))) {
      return entry.canonical;
    }
  }

  // Capitalize first letters if not in taxonomy
  return raw.trim();
}

/**
 * Checks if target jurisdiction matches any member of an accepted jurisdictions list.
 * Supports:
 * - "Any", "Global", "All" universal wildcards
 * - Canonical taxonomy equivalence (e.g., "HK" == "Hong Kong")
 * - Substring matching (e.g., "Delaware (US)" matches "US")
 * 
 * If allowEmptyAsUnrestricted is false, an empty array [] means NO jurisdictions are accepted
 * for this specific leg (e.g. funder does not support intermediary traders).
 */
export function isJurisdictionAccepted(
  acceptedList: string[] | undefined | null,
  target: string | null | undefined,
  options: { allowEmptyAsUnrestricted?: boolean } = { allowEmptyAsUnrestricted: false }
): boolean {
  if (!target) return true; // If no jurisdiction specified on deal, treat as not disqualified
  if (!acceptedList || acceptedList.length === 0) {
    return Boolean(options.allowEmptyAsUnrestricted);
  }

  const targetClean = target.toLowerCase().replace(/[_-]/g, " ").trim();
  if (!targetClean) return true;

  // 1. Wildcard check
  if (
    acceptedList.some((j) => {
      const norm = j.toLowerCase().replace(/[_-]/g, " ").trim();
      return (
        norm === "any" ||
        norm === "global" ||
        norm === "all" ||
        norm === "any / global" ||
        norm === "any global"
      );
    })
  ) {
    return true;
  }

  // 2. Direct string match or substring match
  for (const item of acceptedList) {
    const itemClean = item.toLowerCase().replace(/[_-]/g, " ").trim();
    if (itemClean === targetClean) return true;
    if (itemClean.includes(targetClean) || targetClean.includes(itemClean)) return true;
  }

  // 3. Taxonomy alias equivalence
  for (const entry of UNIVERSAL_JURISDICTION_TAXONOMY) {
    const isTargetInEntry =
      entry.canonical.toLowerCase() === targetClean ||
      entry.aliases.some((a) => targetClean === a || targetClean.includes(a));

    if (isTargetInEntry) {
      const matchesAnyAccepted = acceptedList.some((item) => {
        const itemClean = item.toLowerCase().replace(/[_-]/g, " ").trim();
        return (
          entry.canonical.toLowerCase() === itemClean ||
          entry.aliases.some((a) => itemClean === a || itemClean.includes(a))
        );
      });

      if (matchesAnyAccepted) return true;
    }
  }

  return false;
}
