import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getPrismaClient(): PrismaClient {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    "";
  const isPostgres =
    dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

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

        let copied = false;
        for (const candidate of candidatePaths) {
          if (fs.existsSync(candidate)) {
            try {
              fs.copyFileSync(candidate, targetDbPath);
              copied = true;
              console.log(`✓ Copied SQLite seed database from ${candidate} to ${targetDbPath}`);
              break;
            } catch (err) {
              console.error(`Error copying ${candidate} to ${targetDbPath}:`, err);
            }
          }
        }

        if (!copied) {
          console.warn("⚠️ Warning: seed.db not found in candidates, fallback to direct path.");
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
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma || getPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
