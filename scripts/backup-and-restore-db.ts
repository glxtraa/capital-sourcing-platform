import * as fs from "fs";
import * as path from "path";

// Load .env.local before importing db / PrismaClient
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

import { db } from "../src/lib/db";

// Ordered from independent parent models to dependent child models for clean restore
const MODEL_ORDER: (keyof typeof db | string)[] = [
  // 1. Core Global Settings & Caches
  "appSetting",
  "researchPageCache",
  "documentTaintPolicy",
  "providerCandidate",
  "researchBatch",
  "researchTask",

  // 2. Factoring / Invoice Providers & Requirements
  "provider",
  "providerDocumentRequirement",
  "providerOnboarding",

  // 3. Invoice Deals & Child Entities
  "deal",
  "uploadedDocument",
  "party",
  "financingAsk",
  "riskFlag",
  "researchRun",
  "providerMatch",
  "termSheet",
  "dealDslRevision",

  // 4. Trade Funders & Requirements
  "tradeFunder",
  "tradeFunderDocumentRequirement",

  // 5. Trade Deals & Child Entities
  "tradeDeal",
  "uploadedTradeDocument",
  "tradeParty",
  "contractLeg",
  "tradeFinancingAskModel",
  "tradeRiskFlag",
  "tradeResearchRun",
  "tradeFunderMatchModel",
  "tradeTermSheetModel",

  // 6. Startup Investors & Requirements
  "startupInvestor",
  "startupInvestorDocumentRequirement",

  // 7. Startup Deals & Child Entities
  "startupDeal",
  "uploadedStartupDocument",
  "startupFounder",
  "startupCapTable",
  "startupFinancingAsk",
  "startupTractionMetric",
  "startupCompetitor",
  "startupCommercialProspect",
  "startupProspectContact",
  "startupRiskFlag",
  "startupResearchRun",
  "startupInvestorMatch",
  "startupSyndicateBlueprint",
];

interface BackupPayload {
  version: string;
  timestamp: string;
  totalRecords: number;
  tableCounts: Record<string, number>;
  data: Record<string, any[]>;
}

async function runBackup(): Promise<string> {
  console.log("=== STARTING FULL DATABASE BACKUP (Neon Postgres) ===");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, `db-snapshot-v2.4.13-${timestamp}.json`);
  const latestFilePath = path.join(backupDir, `db-snapshot-latest.json`);

  const payload: BackupPayload = {
    version: "v2.4.13-stable",
    timestamp: new Date().toISOString(),
    totalRecords: 0,
    tableCounts: {},
    data: {},
  };

  for (const modelName of MODEL_ORDER) {
    const delegate = (db as any)[modelName];
    if (!delegate || typeof delegate.findMany !== "function") {
      console.warn(`[WARN] Model delegate ${modelName} not found on PrismaClient, skipping.`);
      continue;
    }

    try {
      const records = await delegate.findMany();
      payload.data[modelName] = records;
      payload.tableCounts[modelName] = records.length;
      payload.totalRecords += records.length;
      if (records.length > 0) {
        console.log(`  ✓ ${modelName.padEnd(35)} : ${records.length} records`);
      }
    } catch (err: any) {
      console.error(`  ✗ Error backing up ${modelName}:`, err.message);
      throw err;
    }
  }

  const jsonStr = JSON.stringify(payload, null, 2);
  fs.writeFileSync(backupFilePath, jsonStr, "utf-8");
  fs.writeFileSync(latestFilePath, jsonStr, "utf-8");

  console.log("\n=======================================================");
  console.log(`✓ BACKUP COMPLETE! Total records: ${payload.totalRecords}`);
  console.log(`✓ Snapshot saved to: ${backupFilePath}`);
  console.log(`✓ Latest symlink/copy: ${latestFilePath}`);
  console.log("=======================================================\n");

  return backupFilePath;
}

async function runRestore(filePath?: string) {
  const targetPath = filePath
    ? path.resolve(process.cwd(), filePath)
    : path.resolve(process.cwd(), "backups", "db-snapshot-latest.json");

  if (!fs.existsSync(targetPath)) {
    console.error(`[ERROR] Backup file not found at: ${targetPath}`);
    process.exit(1);
  }

  console.log(`=== RESTORING DATABASE FROM SNAPSHOT: ${targetPath} ===`);
  const rawData = fs.readFileSync(targetPath, "utf-8");
  const payload: BackupPayload = JSON.parse(rawData);

  console.log(`Snapshot version: ${payload.version} | Timestamp: ${payload.timestamp} | Total: ${payload.totalRecords} records`);

  // Reverse model order for clean deletion (children before parents)
  const reverseModels = [...MODEL_ORDER].reverse();

  console.log("\n[1/2] Purging existing records in foreign-key safe reverse order...");
  for (const modelName of reverseModels) {
    const delegate = (db as any)[modelName];
    if (!delegate || typeof delegate.deleteMany !== "function") continue;
    try {
      const { count } = await delegate.deleteMany({});
      if (count > 0) {
        console.log(`  - Purged ${count} from ${modelName}`);
      }
    } catch (err: any) {
      console.warn(`  ! Note during purge of ${modelName}: ${err.message}`);
    }
  }

  console.log("\n[2/2] Restoring records in parent-to-child order...");
  let restoredTotal = 0;
  for (const modelName of MODEL_ORDER) {
    const records = payload.data[modelName];
    if (!records || records.length === 0) continue;

    const delegate = (db as any)[modelName];
    if (!delegate) continue;

    try {
      for (const record of records) {
        // Date strings in JSON must be parsed back to Date objects where applicable
        const parsedRecord: Record<string, any> = {};
        for (const [k, v] of Object.entries(record)) {
          if (
            typeof v === "string" &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)
          ) {
            parsedRecord[k] = new Date(v);
          } else {
            parsedRecord[k] = v;
          }
        }
        await delegate.create({ data: parsedRecord });
      }
      console.log(`  ✓ Restored ${records.length.toString().padEnd(4)} records into ${modelName}`);
      restoredTotal += records.length;
    } catch (err: any) {
      console.error(`  ✗ Error restoring ${modelName}:`, err.message);
      throw err;
    }
  }

  console.log("\n=======================================================");
  console.log(`✓ RESTORE COMPLETE! Restored ${restoredTotal} records.`);
  console.log("=======================================================\n");
}

async function main() {
  const command = process.argv[2] || "backup";

  if (command === "backup") {
    await runBackup();
  } else if (command === "restore") {
    const targetFile = process.argv[3];
    await runRestore(targetFile);
  } else {
    console.error(`Usage: npx tsx scripts/backup-and-restore-db.ts [backup|restore] [path-to-json]`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("FATAL ERROR in backup-and-restore-db:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
