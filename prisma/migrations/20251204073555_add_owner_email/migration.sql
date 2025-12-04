-- AlterTable
ALTER TABLE "example_qa" ADD COLUMN     "ownerEmail" TEXT;

-- CreateIndex
CREATE INDEX "example_qa_ownerEmail_idx" ON "example_qa"("ownerEmail");
