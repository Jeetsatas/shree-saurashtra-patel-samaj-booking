const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Load environment variables from .env.local or .env if present
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(__dirname, "..", envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
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

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || "";
const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://") || process.env.USE_POSTGRES === "true";

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const postgresSchemaPath = path.join(__dirname, "..", "prisma", "schema.postgres.prisma");
const sqliteSchemaPath = path.join(__dirname, "..", "prisma", "schema.sqlite.prisma");

// If schema.sqlite.prisma does not exist yet, backup existing schema.prisma to schema.sqlite.prisma
if (!fs.existsSync(sqliteSchemaPath) && fs.existsSync(schemaPath)) {
  fs.copyFileSync(schemaPath, sqliteSchemaPath);
}

if (isPostgres) {
  console.log("⚡ PostgreSQL connection detected! Switching schema for Vercel/Postgres deployment...");
  fs.copyFileSync(postgresSchemaPath, schemaPath);
} else {
  console.log("💾 SQLite connection detected for local development...");
  if (fs.existsSync(sqliteSchemaPath)) {
    fs.copyFileSync(sqliteSchemaPath, schemaPath);
  }
}

try {
  console.log("🔄 Generating Prisma Client...");
  execSync("npx prisma generate", { stdio: "inherit" });
} catch (err) {
  console.error("Prisma generate error:", err);
}

