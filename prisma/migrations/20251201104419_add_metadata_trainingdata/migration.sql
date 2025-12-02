-- AlterTable
ALTER TABLE "example_qa" ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "training_data" ADD COLUMN     "metadata" JSONB;
