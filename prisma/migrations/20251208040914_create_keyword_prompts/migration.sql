-- AlterTable
ALTER TABLE "products" ADD COLUMN     "ownerEmail" TEXT;

-- CreateTable
CREATE TABLE "keyword_prompts" (
    "id" SERIAL NOT NULL,
    "keyword" VARCHAR(255) NOT NULL,
    "prompt" TEXT NOT NULL,
    "sampleAnswer" TEXT NOT NULL,
    "additionalInfo" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "ownerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_prompts_keyword_idx" ON "keyword_prompts"("keyword");

-- CreateIndex
CREATE INDEX "keyword_prompts_ownerEmail_idx" ON "keyword_prompts"("ownerEmail");

-- CreateIndex
CREATE INDEX "keyword_prompts_priority_idx" ON "keyword_prompts"("priority");

-- CreateIndex
CREATE INDEX "products_ownerEmail_idx" ON "products"("ownerEmail");
