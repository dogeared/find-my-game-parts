-- CreateTable
CREATE TABLE "EmailFooter" (
    "id" TEXT NOT NULL DEFAULT 'footer',
    "text" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailFooter_pkey" PRIMARY KEY ("id")
);
