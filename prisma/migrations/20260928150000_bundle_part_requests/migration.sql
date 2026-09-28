-- Bundled part requests: a single submission for one game can now carry
-- multiple line items (PartRequest), grouped under a new PartOrder. Every
-- existing PartRequest row is wrapped into its own one-item PartOrder so no
-- data is lost.

-- CreateTable
CREATE TABLE "PartOrder" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartOrder_pkey" PRIMARY KEY ("id")
);

-- AlterTable (orderId nullable for now — backfilled below before being
-- locked down to NOT NULL)
ALTER TABLE "PartRequest" ADD COLUMN "orderId" TEXT;
ALTER TABLE "PartRequest" ADD COLUMN "quantityAvailable" INTEGER;
ALTER TABLE "PartRequest" RENAME COLUMN "quantity" TO "quantityRequested";

-- Backfill: wrap every existing PartRequest row in its own one-item
-- PartOrder, preserving gameId/requesterId/createdAt — no data is lost.
UPDATE "PartRequest" SET "orderId" = gen_random_uuid()::text;

INSERT INTO "PartOrder" ("id", "gameId", "requesterId", "createdAt")
SELECT "orderId", "gameId", "requesterId", "createdAt" FROM "PartRequest";

ALTER TABLE "PartRequest" ALTER COLUMN "orderId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "PartRequest" DROP CONSTRAINT "PartRequest_gameId_fkey";
ALTER TABLE "PartRequest" DROP CONSTRAINT "PartRequest_requesterId_fkey";

-- DropIndex
DROP INDEX "PartRequest_gameId_createdAt_idx";

-- AlterTable (now safe to drop — superseded by PartOrder via orderId)
ALTER TABLE "PartRequest" DROP COLUMN "gameId";
ALTER TABLE "PartRequest" DROP COLUMN "requesterId";

-- CreateIndex
CREATE INDEX "PartOrder_gameId_createdAt_idx" ON "PartOrder"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "PartRequest_orderId_idx" ON "PartRequest"("orderId");

-- AddForeignKey
ALTER TABLE "PartOrder" ADD CONSTRAINT "PartOrder_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartOrder" ADD CONSTRAINT "PartOrder_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartRequest" ADD CONSTRAINT "PartRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PartOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
