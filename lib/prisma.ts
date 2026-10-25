import { PrismaClient } from "@prisma/client";

// Local environments conventionally use DATABASE_URL. The Supabase
// Vercel Marketplace integration exposes its Prisma-compatible connection
// string as POSTGRES_PRISMA_URL, so accept that name as a production fallback.
const datasourceUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim();

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
