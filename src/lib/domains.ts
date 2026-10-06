const TWO_PART_SLDS = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);

export function hostOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Heuristic registrable domain (example.com, example.com.sg, example.co.jp) without a public-suffix list. */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const sld = parts[parts.length - 2];
  return TWO_PART_SLDS.has(sld) && parts[parts.length - 1].length === 2 ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\b(ltd|limited|inc|llc|pte|pty|plc|co|corp|corporation|group|holdings?)\b/g, "").replace(/[^a-z0-9]/g, "");
}
