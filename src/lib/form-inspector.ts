/**
 * Reads a provider's public application/contact page directly and extracts the form fields it asks
 * for, plus mailto links. This is a plain GET of a public page -- nothing is submitted and no
 * account is touched. Web-search plugins return page TEXT and miss form structure, so this is what
 * lets onboarding research list "all the data a form needs" before an applicant starts.
 *
 * Limits, stated honestly in the output: pages that render their form with JavaScript (most SPAs)
 * show no fields in raw HTML and are reported as such, never guessed at.
 */
import { hostOf } from "@/lib/domains";

export interface InspectedField {
  label: string;
  type: string;
  required: boolean | null;
  options: string[];
  step: string | null;
}

export interface PageInspection {
  url: string;
  ok: boolean;
  status: number | null;
  error?: string;
  fields: InspectedField[];
  hasLoginForm: boolean;
  mailtos: string[];
  formCount: number;
  likelyJsRendered: boolean;
}

const MAX_BYTES = 1_500_000;
const BLOCKED_HOST = /^(localhost|.*\.(local|internal|localhost|test))$|^\d{1,3}(\.\d{1,3}){3}$|^\[|^0x/i;

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
const stripTags = (s: string) => decode(s.replace(/<[^>]*>/g, " "));
const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : null;
};
const hasFlag = (tag: string, name: string) => new RegExp(`\\s${name}(\\s|=|>|/|$)`, "i").test(tag);

export async function inspectFormPage(url: string, timeoutMs = 9000): Promise<PageInspection> {
  const base: PageInspection = { url, ok: false, status: null, fields: [], hasLoginForm: false, mailtos: [], formCount: 0, likelyJsRendered: false };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ...base, error: "invalid URL" };
  }
  if (parsed.protocol !== "https:" || BLOCKED_HOST.test(hostOf(url))) return { ...base, error: "only public https hosts are inspected" };

  let html: string;
  let status: number;
  try {
    const res = await fetch(parsed, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "CapitalSourcingPlatform/1.0 (read-only form inspection)", Accept: "text/html" },
    });
    status = res.status;
    const finalHost = hostOf(res.url);
    if (BLOCKED_HOST.test(finalHost)) return { ...base, status, error: "redirected to a non-public host" };
    if (!res.ok) return { ...base, status, error: `HTTP ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    if (!/html/i.test(type)) return { ...base, status, error: `not HTML (${type})` };
    html = (await res.text()).slice(0, MAX_BYTES);
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }

  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const mailtos = [...new Set([...cleaned.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => decode(m[1]).toLowerCase()))].slice(0, 10);

  const labelsFor = new Map<string, string>();
  for (const m of cleaned.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) {
    const forId = attr(m[1], "for");
    if (forId) labelsFor.set(forId, stripTags(m[2]));
  }

  const formBlocks = [...cleaned.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].map((m) => m[0]);
  const fields: InspectedField[] = [];
  let hasLoginForm = false;
  const seen = new Set<string>();

  formBlocks.forEach((block, idx) => {
    // A login form is a password field with at most a username/email beside it and no sign-up wording;
    // a registration form (several fields, "create"/"confirm"/"register") is NOT a login form.
    const controlCount = [...block.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)].filter(
      (m) => !["hidden", "submit", "button", "image", "reset", "checkbox"].includes((attr(m[2], "type") ?? "text").toLowerCase()),
    ).length;
    const isLogin =
      /type\s*=\s*["']?password/i.test(block) &&
      controlCount <= 3 &&
      !/create|confirm|repeat|retype|sign\s?up|register|new password/i.test(block);
    if (isLogin) hasLoginForm = true;
    const step = isLogin ? "Login (existing account)" : formBlocks.length > 1 ? `Form ${idx + 1}` : null;
    for (const m of block.matchAll(/<(input|select|textarea)\b([^>]*)>(?:([\s\S]*?)<\/select>)?/gi)) {
      const [, el, attrs, inner] = m;
      const type = el.toLowerCase() === "input" ? (attr(attrs, "type") ?? "text").toLowerCase() : el.toLowerCase();
      if (["hidden", "submit", "button", "image", "reset", "search"].includes(type)) continue;
      const id = attr(attrs, "id");
      const wrapped = block.slice(0, m.index).match(/<label\b[^>]*>([^<]*(?:<(?!\/label)[^<]*)*)$/i);
      const label =
        (id && labelsFor.get(id)) ||
        attr(attrs, "aria-label") ||
        (wrapped ? stripTags(wrapped[1]) : "") ||
        attr(attrs, "placeholder") ||
        attr(attrs, "name") ||
        "";
      if (!label) continue;
      const key = `${step}|${label.toLowerCase()}|${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const options =
        el.toLowerCase() === "select" && inner
          ? [...inner.matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)].map((o) => stripTags(o[1])).filter(Boolean).slice(0, 12)
          : [];
      fields.push({
        label: label.replace(/\s*\*\s*$/, "").slice(0, 120),
        type,
        required: hasFlag(attrs, "required") || attr(attrs, "aria-required") === "true" || /\*\s*$/.test(label) ? true : null,
        options,
        step,
      });
    }
  });

  const scriptHeavy = (html.match(/<script\b/gi) ?? []).length >= 5;
  return {
    url,
    ok: true,
    status,
    fields: fields.slice(0, 80),
    hasLoginForm,
    mailtos,
    formCount: formBlocks.length,
    likelyJsRendered: formBlocks.length === 0 && scriptHeavy,
  };
}

/** Plain-text rendering appended to the research findings so the structuring model (and the verifier) can see it. */
export function describeInspection(i: PageInspection): string {
  const head = `## Direct inspection of ${i.url} (fetched by the platform, read-only)`;
  if (!i.ok) return `${head}\nCould not be read: ${i.error ?? "unknown error"}.`;
  const lines = [head, `HTTP ${i.status}; ${i.formCount} HTML form(s) found.`];
  if (i.fields.length) {
    lines.push("Form fields exactly as present in the page HTML:");
    for (const f of i.fields) {
      lines.push(`- [${f.step ?? "Form"}] ${f.label} (${f.type}${f.required ? ", required" : ""}${f.options.length ? `; options: ${f.options.join(" | ")}` : ""})`);
    }
  } else if (i.likelyJsRendered) {
    lines.push("No form fields in the raw HTML: the page appears to render its form with JavaScript, so its fields are NOT visible without running it.");
  } else {
    lines.push("No form fields found in the page HTML.");
  }
  if (i.hasLoginForm) lines.push("The page contains a login form for existing accounts.");
  if (i.mailtos.length) lines.push(`mailto links on the page: ${i.mailtos.join(", ")}`);
  return lines.join("\n");
}

export interface PageText {
  ok: boolean;
  status: number | null;
  error?: string;
  text: string;
}

/** Read-only GET of a public https page, returned as plain text (scripts/styles/tags stripped). */
export async function readPageText(url: string, timeoutMs = 9000): Promise<PageText> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, status: null, error: "invalid URL", text: "" };
  }
  if (parsed.protocol !== "https:" || BLOCKED_HOST.test(hostOf(url))) {
    return { ok: false, status: null, error: "only public https hosts are read", text: "" };
  }
  try {
    const res = await fetch(parsed, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "CapitalSourcingPlatform/1.0 (read-only page check)", Accept: "text/html" },
    });
    if (BLOCKED_HOST.test(hostOf(res.url))) return { ok: false, status: res.status, error: "redirected to a non-public host", text: "" };
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}`, text: "" };
    const html = (await res.text()).slice(0, MAX_BYTES);
    const text = stripTags(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")).slice(0, 30_000);
    return { ok: true, status: res.status, text };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.message : String(e), text: "" };
  }
}
