import { SEED_TRADE_FUNDERS } from "./seed-trade-funders";
import { TradeFunderSchema } from "../src/dsl/trade";

function testSeedFundersSchema() {
  console.log("Testing Phase 3 Seed Funders validation...");

  for (const funder of SEED_TRADE_FUNDERS) {
    const validated = TradeFunderSchema.parse(funder);
    console.log(`  ✓ Validated ${validated.id}: ${validated.name}`);
    console.log(`    Corridors: [${validated.supportedCorridors.join(", ")}]`);
    console.log(`    Umbrella: ${validated.offersUmbrellaFacility ? "YES" : "NO"}`);
    console.log(`    Legs: [${validated.supportedLegs.join(", ")}]`);
  }

  // Corridor checks
  const coalFunders = SEED_TRADE_FUNDERS.filter((f) => f.supportedCorridors.includes("IDN_COAL_ASIA"));
  const agriFunders = SEED_TRADE_FUNDERS.filter((f) => f.supportedCorridors.includes("SEA_AGRI_GLOBAL"));
  const seafoodFunders = SEED_TRADE_FUNDERS.filter((f) => f.supportedCorridors.includes("LATAM_SEAFOOD_ASIA"));

  console.log(`\nCoverage check:`);
  console.log(`- Corridor A (Indonesian Coal): ${coalFunders.length} funders`);
  console.log(`- Corridor B (SE Asian Agri): ${agriFunders.length} funders`);
  console.log(`- Corridor C (LatAm Seafood to Asia): ${seafoodFunders.length} funders`);

  if (coalFunders.length === 0 || agriFunders.length === 0 || seafoodFunders.length === 0) {
    throw new Error("Missing coverage for at least one target corridor!");
  }

  console.log("\n✅ Phase 3 Seed Funders Validation Test Passed Successfully!");
}

testSeedFundersSchema();
