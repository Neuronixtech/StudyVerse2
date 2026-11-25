import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

// Prisma 7 doesn't read .env files itself. Node 22 can, so there's no dotenv
// dependency. The file is for local development only; CI and deployments set
// real environment variables, which take precedence over anything in the file.
const envFile = fileURLToPath(new URL(".env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  // The schema lives at the repository root (Backend_architecture.md §5) so the
  // API and, later, the worker share one data model and one migration history.
  schema: "../../prisma/schema.prisma",
  migrations: {
    path: "../../prisma/migrations",
  },
  datasource: {
    // Migrations run as the database owner role. The API never uses this URL; it
    // connects as the least-privilege role in DATABASE_URL (§13.1).
    // Empty when unset, so `prisma generate` and `prisma validate` work without a
    // database (CI, Docker builds). Commands that need a database fail clearly.
    url: process.env.DATABASE_MIGRATION_URL ?? "",
    // Local `migrate dev` only: a scratch database Prisma uses to check migrations.
    shadowDatabaseUrl: process.env.DATABASE_SHADOW_URL,
  },
});
