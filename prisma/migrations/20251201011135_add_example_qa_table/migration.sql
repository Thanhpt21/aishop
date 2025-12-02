-- CreateTable
CREATE TABLE "example_qa" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "intent" TEXT,
    "category" TEXT,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "example_qa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ExampleQAToTrainingSession" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "example_qa_intent_idx" ON "example_qa"("intent");

-- CreateIndex
CREATE INDEX "example_qa_category_idx" ON "example_qa"("category");

-- CreateIndex
CREATE INDEX "example_qa_language_idx" ON "example_qa"("language");

-- CreateIndex
CREATE INDEX "example_qa_isActive_idx" ON "example_qa"("isActive");

-- CreateIndex
CREATE INDEX "example_qa_createdAt_idx" ON "example_qa"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_ExampleQAToTrainingSession_AB_unique" ON "_ExampleQAToTrainingSession"("A", "B");

-- CreateIndex
CREATE INDEX "_ExampleQAToTrainingSession_B_index" ON "_ExampleQAToTrainingSession"("B");

-- AddForeignKey
ALTER TABLE "_ExampleQAToTrainingSession" ADD CONSTRAINT "_ExampleQAToTrainingSession_A_fkey" FOREIGN KEY ("A") REFERENCES "example_qa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExampleQAToTrainingSession" ADD CONSTRAINT "_ExampleQAToTrainingSession_B_fkey" FOREIGN KEY ("B") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
