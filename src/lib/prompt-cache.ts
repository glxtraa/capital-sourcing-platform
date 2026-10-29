import fs from "fs";
import path from "path";

export interface PromptSnapshot {
  sha256: string;
  templateId: string;
  agentPersonaId: string;
  agentDisplayName: string;
  systemPrompt: string;
  taxonomyOrSchemaHint?: string;
  modelSlug: string;
  firstRecordedAt: string;
}

const MEMORY_CACHE = new Map<string, PromptSnapshot>();

const PROMPT_STORAGE_DIR = path.join(process.cwd(), ".data", "prompt-snapshots");

function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Compute deterministic SHA-256 hash for a prompt string using Web Crypto */
export async function computePromptSha256(
  systemPrompt: string,
  extraHint: string = "",
): Promise<string> {
  const normalized = `${systemPrompt.trim()}\n---TAXONOMY_OR_SCHEMA---\n${extraHint.trim()}`;
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Save a prompt snapshot deduplicated once by its SHA-256 hash */
export async function savePromptSnapshot(snapshot: PromptSnapshot): Promise<void> {
  if (!snapshot.sha256) return;

  // 1. In-memory deduplication
  if (MEMORY_CACHE.has(snapshot.sha256)) return;
  MEMORY_CACHE.set(snapshot.sha256, snapshot);

  // 2. Persistent filesystem storage
  try {
    ensureDirectoryExists(PROMPT_STORAGE_DIR);
    const filePath = path.join(PROMPT_STORAGE_DIR, `${snapshot.sha256}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
    }
  } catch (err) {
    console.warn("Unable to write prompt snapshot to disk:", err);
  }
}

/** Retrieve a saved prompt snapshot by SHA-256 hash */
export async function getPromptSnapshot(sha256: string): Promise<PromptSnapshot | null> {
  if (!sha256) return null;

  if (MEMORY_CACHE.has(sha256)) {
    return MEMORY_CACHE.get(sha256)!;
  }

  try {
    const filePath = path.join(PROMPT_STORAGE_DIR, `${sha256}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content) as PromptSnapshot;
      MEMORY_CACHE.set(sha256, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn("Unable to read prompt snapshot from disk:", err);
  }

  return null;
}
