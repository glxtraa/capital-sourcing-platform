/**
 * Vercel Marketplace integrations (Neon, Blob, etc.) often prefix the env
 * vars they create with the resource's own name rather than the plain name
 * a self-hosted app expects — e.g. connecting a Neon database named "Neon
 * Database" produces `NEON_DATABASE_DATABASE_URL`, not `DATABASE_URL`, and
 * Vercel doesn't let you rename an integration-managed variable. This
 * module resolves the plain name from the first populated fallback so the
 * app keeps working regardless of what a given integration happened to
 * name things, rather than requiring an exact manual copy-paste in the
 * Vercel dashboard every time a resource gets reconnected or renamed.
 *
 * This is defense-in-depth, not a substitute for setting the plain-named
 * var directly where you can (see README.md "Environment variable
 * troubleshooting") — Prisma's own CLI (`migrate deploy`, `studio`) reads
 * `DATABASE_URL` straight from the OS environment before any of this code
 * runs, so it still needs the literal name set for those commands.
 */

const DATABASE_URL_FALLBACKS = [
  "NEON_DATABASE_DATABASE_URL",
  "NEON_DATABASE_POSTGRES_PRISMA_URL",
  "NEON_DATABASE_POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
];

/**
 * Call before constructing PrismaClient. Mutates `process.env.DATABASE_URL`
 * in place (rather than just returning a value) because Prisma's generated
 * client reads `env("DATABASE_URL")` from `process.env` itself at
 * construction time — it doesn't take the connection string as a
 * constructor argument in the schema-driven setup this project uses.
 */
export function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const name of DATABASE_URL_FALLBACKS) {
    const value = process.env[name];
    if (value) {
      process.env.DATABASE_URL = value;
      return value;
    }
  }
  return undefined;
}

// Whatever you happened to name the Blob store when creating it (e.g.
// connecting a second store named "Blob2" produces BLOB2_READ_WRITE_TOKEN)
// -- add more candidates here if you rename/recreate the store again.
const BLOB_TOKEN_FALLBACKS = ["BLOB2_READ_WRITE_TOKEN", "BLOB_STORE_READ_WRITE_TOKEN"];

/**
 * Call before any @vercel/blob operation (put/del/handleUpload/upload) --
 * the SDK reads process.env.BLOB_READ_WRITE_TOKEN internally, not a value
 * passed explicitly through this app's own code, so this has to mutate the
 * env var in place, same as resolveDatabaseUrl above. Client-upload token
 * generation (handleUpload -> generateClientTokenFromReadWriteToken)
 * specifically requires this static token -- Vercel's newer OIDC-based
 * Blob auth does NOT cover this flow, only direct server-side put()/del().
 */
export function resolveBlobReadWriteToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const name of BLOB_TOKEN_FALLBACKS) {
    const value = process.env[name];
    if (value) {
      process.env.BLOB_READ_WRITE_TOKEN = value;
      return value;
    }
  }
  return undefined;
}
