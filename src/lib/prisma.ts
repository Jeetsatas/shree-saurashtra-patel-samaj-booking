import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function getPrismaClient(): PrismaClient {
  const rawDbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    "";
  const isPostgres =
    rawDbUrl.startsWith("postgres://") || rawDbUrl.startsWith("postgresql://");

  if (!isPostgres) {
    const isVercel =
      Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    let targetDbPath = path.join(process.cwd(), "prisma", "dev.db");

    if (isVercel) {
      targetDbPath = "/tmp/dev.db";

      if (!fs.existsSync(targetDbPath)) {
        // Look for bundled seed.db in several standard locations
        const candidatePaths = [
          path.join(process.cwd(), "prisma", "seed.db"),
          path.join(process.cwd(), "seed.db"),
          path.resolve("./prisma/seed.db"),
          path.join(__dirname, "..", "..", "..", "prisma", "seed.db"),
          path.join(__dirname, "..", "..", "prisma", "seed.db"),
          path.join(__dirname, "..", "prisma", "seed.db"),
        ];

        for (const candidate of candidatePaths) {
          if (fs.existsSync(candidate)) {
            try {
              fs.copyFileSync(candidate, targetDbPath);
              console.log(`✓ Copied SQLite seed database from ${candidate} to ${targetDbPath}`);
              break;
            } catch (err) {
              console.error(`Error copying ${candidate} to ${targetDbPath}:`, err);
            }
          }
        }
      }
    }

    const sqliteUrl = `file:${targetDbPath}`;
    return new PrismaClient({
      datasources: {
        db: {
          url: sqliteUrl,
        },
      },
      log: ["error"],
    });
  }

  // Optimize PostgreSQL / Neon connection for serverless:
  // When using connection pooler, pgbouncer=true prevents prepared statement stalls.
  let optimizedUrl = rawDbUrl;
  if (optimizedUrl.includes("-pooler") && !optimizedUrl.includes("pgbouncer=true")) {
    const separator = optimizedUrl.includes("?") ? "&" : "?";
    optimizedUrl = `${optimizedUrl}${separator}pgbouncer=true&connect_timeout=15&connection_limit=5`;
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: optimizedUrl,
      },
    },
    log: ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

// In serverless / Next.js, reuse client across warm invocations
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
