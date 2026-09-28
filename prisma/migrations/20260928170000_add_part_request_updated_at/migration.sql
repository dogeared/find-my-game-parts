-- AlterTable
-- Default backfills existing rows to "now" (their true last-changed time
-- isn't tracked pre-migration) and stays as a DB-level safety net; Prisma's
-- @updatedAt still sets this explicitly on every write going forward.
ALTER TABLE "PartRequest" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
