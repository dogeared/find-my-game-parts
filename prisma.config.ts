import { defineConfig, env } from "prisma/config";

// Prisma 7 moved the connection URL out of schema.prisma (datasource `url`
// is no longer supported) — Migrate/CLI reads it from here, and
// PrismaClient itself gets a driver adapter at runtime (lib/prisma.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
