import { SourceCorpus } from "../src/dsl/compiler/source-corpus";
import { verifyGroundedField, buildNumericRegexes } from "../src/dsl/compiler/deterministic-verifier";
import type { GroundedFieldInspection } from "../src/dsl/compiler/types";

async function runTestSuite() {
  console.log("================================================================================");
  console.log("RUNNING DSL COMPILER v3.0 DETERMINISTIC SOURCE VERIFIER TESTS");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  const corpus = new SourceCorpus();

  // 1. Setup mock PDF deck text
  const pitchDeckText = `
--- Page 1 ---
E2G FOOD
Tackling global hunger with nutritious food, delivered with proof.
Every FOOD bar donated is tracked from production to the community.

--- Page 2 ---
The Problem: 828M people face hunger globally.
Traditional food donation lacks transparency and end-to-end auditability.

--- Page 3 ---
Financing Ask
Target Raise: £1,000,000 via SAFE.
Use of proceeds: Inventory scaling, supply chain verification, expansion in East Africa.
`;
  corpus.addTextDocument("E2G FOOD_£1M Growth Raise.pdf", pitchDeckText);

  // 2. Setup mock Lending Agreement PDF text
  const lendingAgreementText = `
--- Page 1 ---
THIS LENDING AGREEMENT is entered into between:
(1) Favorite Medium Asia Limited, a company incorporated in Hong Kong ("Borrower"); and
(2) Beech Fork Pte Ltd, a company incorporated in Singapore ("Lender").
Whereas the Obligor under the underlying receivables contracts is TISI, incorporated in Japan.
`;
  corpus.addTextDocument("LENDING AGREEMENT_FM Asia.pdf", lendingAgreementText);

  // 3. Setup mock Web page
  corpus.addWebPages([
    {
      url: "https://www.vipurposefund.org/challenge",
      markdown: `# 2026 Impact Challenge\n\nWe're looking for ideas that protect, restore, and regenerate our ocean. Winners receive up to $200,000 in grant funding.`,
    },
  ]);

  console.log("--------------------------------------------------------------------------------");
  console.log("TEST 1: Hallucinated Clause & Quote Rejection (E2G FOOD Scenario)");
  console.log("--------------------------------------------------------------------------------");
  // Agent tries to claim valuationCapUsd = 12000000 at Clause 1.2
  const hallucinatedInspection: GroundedFieldInspection = {
    jsonPath: "$.financingAsk.valuationCapUsd",
    value: 12000000,
    provenance: {
      sourceRef: "E2G FOOD_£1M Growth Raise.pdf",
      location: "Clause 1.2",
      verbatimQuote: "Valuation Cap shall be $12,000,000",
      derivation: "VERBATIM_EXTRACTED",
    },
    expectedType: "number",
  };

  const diags1 = verifyGroundedField(hallucinatedInspection, corpus);
  assert(diags1.length > 0, "Verifier detected hallucinated clause and quote");
  assert(
    diags1.some((d) => d.code === "LOCATION_COORDINATE_NOT_FOUND"),
    "Emitted LOCATION_COORDINATE_NOT_FOUND for non-existent 'Clause 1.2'"
  );

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST 2: Role Contradiction Rejection (Beech Fork Scenario)");
  console.log("--------------------------------------------------------------------------------");
  // Agent tries to extract Beech Fork as BORROWER when quote says Lender
  const roleInversionInspection: GroundedFieldInspection = {
    jsonPath: "$.parties[1]",
    value: "Beech Fork Pte Ltd",
    provenance: {
      sourceRef: "LENDING AGREEMENT_FM Asia.pdf",
      location: "Page 1",
      verbatimQuote: "Beech Fork Pte Ltd, a company incorporated in Singapore (\"Lender\")",
      derivation: "VERBATIM_EXTRACTED",
    },
    roleExpected: "BORROWER",
  };

  const diags2 = verifyGroundedField(roleInversionInspection, corpus);
  assert(diags2.length > 0, "Verifier detected role contradiction");
  assert(
    diags2.some((d) => d.code === "ROLE_CONTRADICTS_QUOTE"),
    "Emitted ROLE_CONTRADICTS_QUOTE when Lender was claimed as Borrower"
  );

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST 3: Valid Factoring Parties Pass (Favorite Medium Asia & TISI)");
  console.log("--------------------------------------------------------------------------------");
  const validBorrower: GroundedFieldInspection = {
    jsonPath: "$.parties[0]",
    value: "Favorite Medium Asia Limited",
    provenance: {
      sourceRef: "LENDING AGREEMENT_FM Asia.pdf",
      location: "Page 1",
      verbatimQuote: "Favorite Medium Asia Limited, a company incorporated in Hong Kong (\"Borrower\")",
      derivation: "VERBATIM_EXTRACTED",
    },
    roleExpected: "BORROWER",
  };
  const validObligor: GroundedFieldInspection = {
    jsonPath: "$.parties[1]",
    value: "TISI",
    provenance: {
      sourceRef: "LENDING AGREEMENT_FM Asia.pdf",
      location: "Page 1",
      verbatimQuote: "the Obligor under the underlying receivables contracts is TISI, incorporated in Japan",
      derivation: "VERBATIM_EXTRACTED",
    },
    roleExpected: "OBLIGOR",
  };

  const diags3a = verifyGroundedField(validBorrower, corpus);
  const diags3b = verifyGroundedField(validObligor, corpus);
  assert(diags3a.length === 0, "Valid Borrower (Favorite Medium Asia) passed with 0 errors");
  assert(diags3b.length === 0, "Valid Obligor (TISI) passed with 0 errors");

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST 4: Web URL Verified Grant Amount ($200,000)");
  console.log("--------------------------------------------------------------------------------");
  const validGrant: GroundedFieldInspection = {
    jsonPath: "$.maxCheckUsd",
    value: 200000,
    provenance: {
      sourceRef: "https://www.vipurposefund.org/challenge",
      location: "Section: 2026 Impact Challenge",
      verbatimQuote: "Winners receive up to $200,000 in grant funding.",
      derivation: "VERBATIM_EXTRACTED",
    },
    expectedType: "number",
  };
  const diags4 = verifyGroundedField(validGrant, corpus);
  assert(diags4.length === 0, "Web URL quote and numeric amount $200,000 passed with 0 errors");

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST 5: Numeric Regex Robustness Across Formatting");
  console.log("--------------------------------------------------------------------------------");
  const test12M = buildNumericRegexes(12000000);
  assert(test12M.some((rx) => rx.test("$12,000,000")), "12,000,000 matches currency format");
  assert(test12M.some((rx) => rx.test("12M")), "12000000 matches '12M'");
  assert(test12M.some((rx) => rx.test("12.0 million")), "12000000 matches '12.0 million'");

  const test85Pct = buildNumericRegexes(85);
  assert(test85Pct.some((rx) => rx.test("85%")), "85 matches '85%'");
  assert(test85Pct.some((rx) => rx.test("85 percent")), "85 matches '85 percent'");

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST 6: Strict JSON Schema Generation (zodToResponseFormat)");
  console.log("--------------------------------------------------------------------------------");
  const { zodToResponseFormat } = await import("../src/lib/json-schema");
  const { DocumentExtractionSchema } = await import("../src/dsl/schema");

  const rf = zodToResponseFormat(DocumentExtractionSchema, "DocumentExtraction") as any;
  assert(rf.type === "json_schema", "response_format.type is 'json_schema'");
  assert(rf.json_schema.strict === true, "json_schema strict mode is true");
  assert(
    rf.json_schema.schema.properties.documentSummary.type === "string",
    "documentSummary is strictly defined as type 'string' (preventing object return)"
  );
  assert(
    rf.json_schema.schema.properties.parties.items.required.includes("legalName"),
    "parties.items strictly requires 'legalName'"
  );
  assert(
    rf.json_schema.schema.properties.parties.items.required.includes("role"),
    "parties.items strictly requires 'role'"
  );

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST 7: Graceful Interception of Schema Mismatches (safeParse Recovery)");
  console.log("--------------------------------------------------------------------------------");
  // Simulate the exact malformed payload from the user's error:
  const malformedLlmOutput = {
    documentSummary: { summary: "Lending agreement for FM Asia", keyTerms: [] }, // object instead of string
    parties: [{ role: "BORROWER" }], // missing legalName
    riskFlags: [{ category: "NOT_A_REAL_CATEGORY", severity: "high" }], // invalid enum + string severity
  };

  const parseResult = DocumentExtractionSchema.safeParse(malformedLlmOutput);
  assert(parseResult.success === false, "safeParse caught malformed schema output");
  if (!parseResult.success) {
    const issuePaths = parseResult.error.issues.map((i) => i.path.join("."));
    assert(issuePaths.includes("documentSummary"), "Caught 'documentSummary' object mismatch");
    assert(issuePaths.includes("parties.0.legalName"), "Caught missing 'legalName' on parties[0]");
    assert(issuePaths.includes("riskFlags.0.category"), "Caught invalid category on riskFlags[0]");
    assert(issuePaths.includes("riskFlags.0.severity"), "Caught non-numeric severity on riskFlags[0]");
  }

  console.log("\n================================================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
