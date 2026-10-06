import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { getOpenRouterClient, ONBOARDING_MODEL, webSearchPlugin } from "@/lib/openrouter";
import { describeInspection, inspectFormPage, type PageInspection } from "@/lib/form-inspector";
import { zodToResponseFormat } from "@/lib/json-schema";
import { ProviderConfidence } from "@/dsl/provider-schema";
import { registrableDomain, hostOf, normalizeName } from "@/lib/domains";

const SYSTEM_PROMPT = readFileSync(join(process.cwd(), "src/agents/prompts/onboarding.md"), "utf-8");

// Stay under Vercel Hobby's 60s function cap: a hung provider call fails fast and the task retries.
// An AbortSignal (unlike the SDK's `timeout`, which stops counting once headers arrive) covers the body too.
const requestOptions = () => ({ signal: AbortSignal.timeout(50_000), maxRetries: 0 });

export const OnboardingSchema = z.object({
  applicationRoute: z.enum(["ONLINE_FORM", "EMAIL", "RELATIONSHIP_MANAGER", "BROKER", "NONE_PUBLIC"]),
  applicationUrl: z.string().nullable().describe("Direct URL of the application/sign-up/enquiry form, if any"),
  accountRequiredBeforeForm: z.boolean().nullable().describe("Must an account be created before the full form is visible?"),
  formFieldsVisibility: z
    .enum(["FULL", "PARTIAL", "NOT_VISIBLE"])
    .describe("How much of the form's fields you could actually see on public pages"),
  contacts: z.array(
    z.object({
      channel: z.enum(["EMAIL", "PHONE", "WEB_FORM"]),
      value: z.string(),
      purpose: z.enum(["GENERAL", "NEW_BUSINESS", "COMPLIANCE", "SUPPORT"]),
      sourceUrl: z.string(),
    }),
  ),
  formFields: z.array(
    z.object({
      label: z.string(),
      required: z.boolean().nullable(),
      step: z.string().nullable(),
      note: z.string().nullable(),
    }),
  ),
  documentsToPrepare: z.array(z.object({ code: z.string(), note: z.string().nullable() })),
  steps: z.array(z.string()),
  eligibilityChecks: z.array(z.string()),
  typicalTurnaround: z.string().nullable(),
  confidence: ProviderConfidence,
  sources: z.array(z.string()),
  notes: z.string().nullable(),
});
export type OnboardingDTO = z.infer<typeof OnboardingSchema>;
const RESPONSE_FORMAT = zodToResponseFormat(OnboardingSchema, "ProviderOnboarding");

export interface OnboardingSubject {
  name: string;
  type: string;
  product: string;
  applicationUrl: string | null;
  sources: string[];
}

export interface Findings {
  findings: string;
  citedUrls: string[];
}

/** Step 1 (one model call): web-search-augmented read of the provider's official pages. */
export async function searchOnboarding(p: OnboardingSubject): Promise<Findings> {
  const client = getOpenRouterClient();
  const known = [p.applicationUrl, ...p.sources].filter(Boolean).join("\n");
  const params: ChatCompletionCreateParamsNonStreaming & { plugins?: readonly unknown[] } = {
    model: ONBOARDING_MODEL,
    plugins: webSearchPlugin(8),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Provider: "${p.name}" (${p.type.replaceAll("_", " ").toLowerCase()}; product: ${p.product}).\n` +
          (known ? `Pages we already know about:\n${known}\n\n` : "\n") +
          `Research how a prospective borrower contacts this provider and applies. Quote exact email ` +
          `addresses, phone numbers, URLs and form-field labels as written on the official pages, and ` +
          `give the page URL each came from. Where the application is an online form or sign-up flow, ` +
          `list every field and step visible before the applicant would need to log in. State plainly ` +
          `anything that is not published or that you could not see.`,
      },
    ],
  };
  // Read the known application page directly, in parallel with the web search.
  const [res, page] = await Promise.all([
    client.chat.completions.create(params, requestOptions()),
    p.applicationUrl ? inspectFormPage(p.applicationUrl) : Promise.resolve(null),
  ]);
  const searched = res.choices[0]?.message?.content;
  if (!searched) throw new Error(`Onboarding search returned nothing for "${p.name}".`);
  const findings = page ? `${searched}\n\n${describeInspection(page)}` : searched;
  type Annotation = { type: string; url_citation?: { url: string } };
  const annotations = (res.choices[0]?.message as { annotations?: Annotation[] } | undefined)?.annotations ?? [];
  const citedUrls = annotations.filter((a) => a.type === "url_citation" && a.url_citation).map((a) => a.url_citation!.url);
  return { findings, citedUrls };
}

/** Step 2 (one model call): structure the findings, then drop anything that fails verification. */
export async function structureOnboarding(p: OnboardingSubject, { findings, citedUrls }: Findings): Promise<OnboardingDTO> {
  const started = Date.now();
  const client = getOpenRouterClient();
  const res = await client.chat.completions.create(
    {
      model: ONBOARDING_MODEL,
      response_format: RESPONSE_FORMAT,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Your research on "${p.name}":\n\n${findings}\n\n` +
            (citedUrls.length ? `URLs cited:\n${citedUrls.join("\n")}\n\n` : "") +
            `Record this per the schema. Only include contacts, URLs and form fields that appear in the ` +
            `research above. Use null/empty for anything not published. Role mailboxes only, no individuals.`,
        },
      ],
    },
    requestOptions(),
  );
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error(`Onboarding structuring returned nothing for "${p.name}".`);
  const verified = verifyOnboarding(p, OnboardingSchema.parse(JSON.parse(content)), findings, citedUrls);

  // If the model identified an application page, read its real form fields from the page HTML and
  // let them replace the model's list -- the page is the source of truth, not the model.
  const pageUrl = verified.applicationUrl ?? verified.contacts.find((c) => c.channel === "WEB_FORM")?.value ?? null;
  if (pageUrl && Date.now() - started < 38_000) {
    return applyInspection(verified, await inspectFormPage(pageUrl));
  }
  return verified;
}

export function applyInspection(dto: OnboardingDTO, page: PageInspection): OnboardingDTO {
  const formFields = page.fields.map((f) => ({
    label: f.label,
    required: f.required,
    step: f.step,
    note: [f.type, f.options.length ? `options: ${f.options.join(" | ")}` : null].filter(Boolean).join("; ") || null,
  }));
  if (formFields.length === 0) {
    const why = !page.ok
      ? `application page could not be read (${page.error})`
      : page.likelyJsRendered
        ? "application page renders its form with JavaScript, so its fields are not visible without a browser"
        : "no form fields found in the application page HTML";
    const unconfirmed = dto.formFields.length > 0;
    return {
      ...dto,
      formFieldsVisibility: unconfirmed ? "PARTIAL" : dto.formFieldsVisibility,
      notes: [
        dto.notes,
        unconfirmed
          ? `Form fields below were reported from search text and could NOT be confirmed in the page HTML (${why}) — verify before relying on them.`
          : `Form fields not captured: ${why}.`,
      ].filter(Boolean).join("\n"),
    };
  }
  return {
    ...dto,
    formFields,
    formFieldsVisibility: page.hasLoginForm ? "PARTIAL" : "FULL",
    notes: [dto.notes, `Form fields read directly from ${page.url}.`].filter(Boolean).join("\n"),
  };
}

const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Guard against hallucinated or third-party contact details. A contact survives only if its value
 * literally appears in the research text and (for email / web form) sits on the provider's own
 * domain. Anything dropped is listed in `notes` so the reviewer can see what was removed.
 */
export function verifyOnboarding(p: OnboardingSubject, dto: OnboardingDTO, findings: string, citedUrls: string[]): OnboardingDTO {
  const haystack = findings.toLowerCase();
  const urlPool = new Set([...citedUrls, ...p.sources, ...(p.applicationUrl ? [p.applicationUrl] : [])].map((u) => u.toLowerCase()));
  // "Own" domains: the stored application URL's domain, plus any other domain whose name matches the
  // provider's name (so aggregator/directory/social domains never count as the provider's own).
  const nameKey = normalizeName(p.name);
  const looksLikeProvider = (d: string) => {
    const label = d.split(".")[0];
    return label.length >= 4 && (nameKey.includes(label) || label.includes(nameKey.slice(0, 6)));
  };
  const ownDomains = new Set<string>();
  if (p.applicationUrl) ownDomains.add(registrableDomain(hostOf(p.applicationUrl)));
  for (const u of [...p.sources, dto.applicationUrl, ...dto.sources, ...citedUrls]) {
    const d = u ? registrableDomain(hostOf(u)) : "";
    if (d && looksLikeProvider(d)) ownDomains.add(d);
  }
  const dropped: string[] = [];

  const contacts = dto.contacts.filter((c) => {
    const v = c.value.trim();
    let ok = false;
    let why = "";
    if (c.channel === "EMAIL") {
      const domain = v.split("@")[1]?.toLowerCase() ?? "";
      ok = haystack.includes(v.toLowerCase()) && ownDomains.has(registrableDomain(domain));
      why = !haystack.includes(v.toLowerCase()) ? "not found in sources" : "not on the provider's own domain";
    } else if (c.channel === "PHONE") {
      ok = digits(v).length >= 7 && digits(findings).includes(digits(v));
      why = "not found in sources";
    } else {
      ok = /^https:\/\//i.test(v) && (haystack.includes(v.toLowerCase()) || urlPool.has(v.toLowerCase())) && ownDomains.has(registrableDomain(hostOf(v)));
      why = "not an https page found in sources on the provider's own domain";
    }
    if (!ok) dropped.push(`${c.channel} ${v} (${why})`);
    return ok;
  });

  let applicationUrl = dto.applicationUrl;
  if (applicationUrl && !(/^https:\/\//i.test(applicationUrl) && (haystack.includes(applicationUrl.toLowerCase()) || urlPool.has(applicationUrl.toLowerCase())))) {
    dropped.push(`applicationUrl ${applicationUrl} (not found in sources)`);
    applicationUrl = null;
  }

  const sources = dto.sources.filter((u) => {
    const ok = ownDomains.has(registrableDomain(hostOf(u)));
    if (!ok) dropped.push(`source ${u} (not the provider's own site)`);
    return ok;
  });

  // Never keep a form field list the agent says it could not see.
  const formFields = dto.formFieldsVisibility === "NOT_VISIBLE" ? [] : dto.formFields;

  const note = dropped.length ? `Removed by verification: ${dropped.join("; ")}.` : null;
  return {
    ...dto,
    applicationUrl,
    contacts,
    sources,
    formFields,
    notes: [dto.notes, note].filter(Boolean).join("\n") || null,
  };
}
