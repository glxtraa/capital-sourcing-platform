import { PrismaClient } from "@prisma/client";

// Standard Next.js/Vercel serverless singleton pattern — avoids exhausting
// Postgres connections across hot-reloads in dev / concurrent lambda
// invocations in production. If you deploy to Vercel with a pooled
// connection string (Neon/Vercel Postgres both provide one), this is enough;
// for very high concurrency, put PgBouncer or Prisma Accelerate in front.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
