# Capital Sourcing Platform

A web app version of a manual workflow: upload a company's deal documents, have an AI agent
extract a structured deal spec (the "DSL"), match it against a researched capital-provider
database, and — if the database can't find a match — have the system go research one, then try
matching again. A second on-demand agent benchmarks the deal against those matched alternatives
to help a prospective lender price and structure their own offer.

If you have access to the manual system this was built from (a set of Claude Code skills:
`deal-intake`, `capital-provider-research`, `application-pack-builder`, `lender-benchmark`, plus
a hand-maintained `providers.json`), every piece of this app has a direct, named counterpart
there — see "Where each piece came from" below. This app exists independently of that system;
you don't need it to run this.

## What's actually wired up vs. stubbed

This is a working scaffold, not a finished product. Read this section before assuming something
works end-to-end.

**Fully wired, will run as written:**
- The database schema (`prisma/schema.prisma`) and the Zod DSL that validates against it
  (`src/dsl/`).
- The extraction, research, and benchmark agents (`src/agents/`) — real Anthropic API calls,
  real prompts, real structured-output validation.
- The durable multi-step pipeline and feedback loop (`src/inngest/functions/`) — extraction →
  matching → (if nothing matches) research → matching again.
- Every API route and UI page.
- The migration script that seeds real data from the manual system's `providers.json`
  (`scripts/import-legacy-providers.ts`) — dry-run validated against the actual 31-entry file
  this was built from.

**Deliberately stubbed — replace before real use:**
- **Auth** (`src/lib/auth.ts`): every request currently resolves to a single hardcoded
  `demo-org`. Fine for building/testing the pipeline; not fine the moment real, confidential
  deal documents are involved. Swap in Clerk or Auth.js — the rest of the app already scopes
  everything by `orgId`, so this is a one-function change, not a schema change.
- **The per-match reasoning step** (`src/inngest/functions/match-providers.ts`): writes
  `ProviderMatch` rows from the mechanical eligibility filter directly. The manual
  `deal-intake` skill's actual rule is "don't stop at the mechanical filter — reason about
  gating factors, recurring-vs-one-off framing, etc." Wiring an LLM call into that step (same
  pattern as `benchmark-agent.ts`) is the natural next addition; left as mechanical-only here to
  keep the pipeline's control flow legible in a first read.
- **File-type coverage**: the extraction agent sends PDFs to Claude as native `document` blocks
  and everything else as raw UTF-8 text. A scanned image, a `.docx`, or a non-UTF-8 file will
  need a conversion step first.

## Architecture

```
Upload (UI) → Vercel Blob → UploadedDocument rows → deal/documents.uploaded event
    → [Inngest] extractDeal: per-file extraction (Claude, forced tool-use) → merge → DealSpec
        → if confident: deal/matching.requested
    → [Inngest] matchProviders: mechanical eligibility filter (TS port of the manual
       query_providers.py) against the Provider table
        → if zero eligible: provider/research.requested  (the feedback loop)
            → [Inngest] researchProviders: Claude + web_search tool → new Provider row
                → re-fires deal/matching.requested
        → else: write ProviderMatch rows, deal.status = COMPLETE
    → (on demand, from the UI) runLenderBenchmark: Claude call over the deal + its matches
       → TermSheet row
```

**Why Inngest.** The feedback loop (research → rematch) can take minutes and needs individual
steps to retry/resume independently — a single Vercel serverless function has a hard timeout and
no built-in step memoization. Inngest functions still deploy as ordinary Vercel functions (see
`src/app/api/inngest/route.ts`); Trigger.dev is a reasonable alternative if you'd rather use that.

**Why Claude reads PDFs directly instead of a separate PDF-parsing library.** The actual
documents this system was built against — bilingual Chinese/Indonesian coal contracts with
tables, stamps, and handwritten signatures — are exactly the kind of document a naive
text-extraction library mangles. Sending the PDF bytes straight to the model as a `document`
content block lets it read the real layout.

**Why the Provider table is separate from any one org/deal.** A capital provider's terms aren't
confidential — the same researched entry (a bank's product page, a marketplace's ticket-size
floor) is useful across every deal that might match it, exactly like the manual system's shared
`providers.json`.

## The DSL

`src/dsl/schema.ts` is the extraction agent's output contract — a Zod schema, not a bespoke
textual language, because that gets you a JSON Schema for Claude's tool-use (see
`src/lib/zod-tool.ts`), a TypeScript type, and a runtime validator from one definition. The
`FinancingStructureType` enum
(`POST_SHIPMENT_RECEIVABLES_DISCOUNTING` / `PRE_SHIPMENT_PROCUREMENT_FINANCE` /
`PRE_EXPORT_BORROWING_BASE` / `ENTERPRISE_SCF_REVERSE_FACTORING`) and the chain-of-title fields on
`Party` are the two things this schema learned it needed the hard way, from real deals with real
documents — see `prisma/schema.prisma`'s comments for exactly which worked example taught it
which field.

`src/dsl/provider-schema.ts` mirrors the `Provider` table the same way, and is what the research
agent must emit — new fields there should be added with the same discipline the manual
`capital-provider-research` skill enforces on itself: never fabricate a number that isn't
published; say `null`/"not disclosed" instead.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and ANTHROPIC_API_KEY at minimum
npx prisma migrate dev       # creates the schema in your Postgres
npm run seed:providers       # seeds real provider data from the manual system, if you have
                              # Capital_Sourcing_System/providers_db/providers.json available
                              # (pass a path if it's not at ../Capital_Sourcing_System/...)
npm run dev                  # http://localhost:3000
```

In a second terminal, for the durable pipeline to actually run locally:

```bash
npm run inngest:dev
```

Without a Postgres available, `npm run build` still succeeds (every page is
`dynamic = "force-dynamic"`, so nothing needs the database at build time) — useful for
confirming the app compiles before you've stood up infrastructure.

## Deploying to Vercel

1. Push this folder to its own GitHub repo (that's why it's separate from any deal data — see
   below) and import it in Vercel.
2. **Postgres**: Vercel Storage → Create Database → Postgres (or connect a Neon project). Vercel
   sets `DATABASE_URL` (and a few related vars) automatically once attached.
3. **Blob storage**: Vercel Storage → Create Database → Blob. Sets `BLOB_READ_WRITE_TOKEN`
   automatically.
4. **Inngest**: install the Inngest integration from the Vercel Marketplace, or create an app at
   inngest.com and set `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` manually. Either way it needs to
   know your deployed `/api/inngest` URL — the Vercel integration handles this for you.
5. Set `ANTHROPIC_API_KEY` (Project → Settings → Environment Variables).
6. Run `npx prisma migrate deploy` against the production `DATABASE_URL` once (locally, with
   `vercel env pull` first, or from a one-off Vercel deployment step) — migrations don't run
   automatically on deploy.
7. Run `npm run seed:providers` once, similarly, to seed real provider data instead of launching
   with an empty table.
8. Deploy. Auth is still the `demo-org` stub at this point — do this step before step 1 if this
   will ever hold real confidential documents, not after.

## Why this is its own folder/repo

This platform code has no confidential company data in it — the manual system's actual deal
folders (contracts, call transcripts, corporate documents for real companies) live in sibling
directories that were never meant to leave this machine. Keeping this folder separate means it
can go to GitHub — and from there to Vercel — on its own, without dragging any of that along.
`scripts/import-legacy-providers.ts` is the one deliberate bridge between the two: a local-only
migration utility that reads the manual system's `providers.json` (itself just researched public
information about banks/factors/marketplaces, not confidential) to seed this app's database. It
is not called by the deployed app.

## Where each piece came from (manual system → this app)

| Manual system | This app |
|---|---|
| A company's `Capital_Sourcing/deal_profile.json`, hand-written | `DealSpec` (src/dsl/schema.ts), agent-extracted |
| `deal-intake` skill, Steps 0-1 (classify structure type, read the data room) | `extractFromDocument` + `mergeExtractions` (src/agents/) |
| `deal-intake` skill, Step 2 (`query_providers.py` + reasoning about gating factors) | `matchAllProviders` (src/lib/matching.ts) + the `matchProviders` Inngest function |
| `capital-provider-research` skill (Modes A/B) | `researchNewProvider` (src/agents/research-agent.ts) + the `researchProviders` Inngest function |
| `Capital_Sourcing_System/providers_db/providers.json` | The `Provider` table, seeded by `scripts/import-legacy-providers.ts` |
| `application-pack-builder` skill | Not yet ported — the gap-analysis/RFQ-drafting output; a natural next addition alongside the matching step's reasoning upgrade |
| `lender-benchmark` skill | `runLenderBenchmark` (src/agents/benchmark-agent.ts) + the on-demand `/api/deals/:id/benchmark` route |
