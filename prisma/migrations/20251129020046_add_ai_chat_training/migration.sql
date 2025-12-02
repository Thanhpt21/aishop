/*
  Warnings:

  - You are about to drop the `ApiKey` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PromptHash` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Response` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrainingDataExport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_userId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_userId_fkey";

-- DropTable
DROP TABLE "ApiKey";

-- DropTable
DROP TABLE "Conversation";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "PromptHash";

-- DropTable
DROP TABLE "Response";

-- DropTable
DROP TABLE "TrainingDataExport";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "userId" TEXT,
    "usedInTraining" BOOLEAN NOT NULL DEFAULT false,
    "trainingScore" DOUBLE PRECISION,
    "tags" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER,
    "intent" TEXT,
    "category" TEXT,
    "sentiment" TEXT,
    "confidence" DOUBLE PRECISION,
    "embedding" TEXT,
    "isTrainingExample" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "usage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_hashes" (
    "id" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "responseId" TEXT,
    "normalizedPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_hashes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "datasetConfig" JSONB,
    "dataSource" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "modelName" TEXT,
    "baseModel" TEXT,
    "parameters" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "accuracy" DOUBLE PRECISION,
    "loss" DOUBLE PRECISION,
    "metrics" JSONB,
    "confusionMatrix" JSONB,
    "modelPath" TEXT,
    "logsPath" TEXT,
    "reportPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_data" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "input" TEXT NOT NULL,
    "output" TEXT,
    "category" TEXT,
    "intent" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "source" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "difficulty" TEXT,
    "trainingSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_evaluations" (
    "id" TEXT NOT NULL,
    "testDataset" JSONB,
    "metrics" JSONB NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "details" JSONB,
    "trainingSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployed_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "modelPath" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "accuracy" DOUBLE PRECISION,
    "latency" DOUBLE PRECISION,
    "trainingSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployedAt" TIMESTAMP(3),

    CONSTRAINT "deployed_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "preprocessingSteps" JSONB,
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_data_exports" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "conversations_userId_idx" ON "conversations"("userId");

-- CreateIndex
CREATE INDEX "conversations_usedInTraining_idx" ON "conversations"("usedInTraining");

-- CreateIndex
CREATE INDEX "conversations_createdAt_idx" ON "conversations"("createdAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "messages_userId_idx" ON "messages"("userId");

-- CreateIndex
CREATE INDEX "messages_intent_idx" ON "messages"("intent");

-- CreateIndex
CREATE INDEX "messages_category_idx" ON "messages"("category");

-- CreateIndex
CREATE INDEX "messages_isTrainingExample_idx" ON "messages"("isTrainingExample");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "responses_hash_key" ON "responses"("hash");

-- CreateIndex
CREATE INDEX "training_sessions_userId_idx" ON "training_sessions"("userId");

-- CreateIndex
CREATE INDEX "training_sessions_status_idx" ON "training_sessions"("status");

-- CreateIndex
CREATE INDEX "training_sessions_modelType_idx" ON "training_sessions"("modelType");

-- CreateIndex
CREATE INDEX "training_sessions_createdAt_idx" ON "training_sessions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "training_data_messageId_key" ON "training_data"("messageId");

-- CreateIndex
CREATE INDEX "training_data_messageId_idx" ON "training_data"("messageId");

-- CreateIndex
CREATE INDEX "training_data_trainingSessionId_idx" ON "training_data"("trainingSessionId");

-- CreateIndex
CREATE INDEX "training_data_category_idx" ON "training_data"("category");

-- CreateIndex
CREATE INDEX "training_data_intent_idx" ON "training_data"("intent");

-- CreateIndex
CREATE INDEX "training_data_qualityScore_idx" ON "training_data"("qualityScore");

-- CreateIndex
CREATE INDEX "model_evaluations_trainingSessionId_idx" ON "model_evaluations"("trainingSessionId");

-- CreateIndex
CREATE INDEX "model_evaluations_overallScore_idx" ON "model_evaluations"("overallScore");

-- CreateIndex
CREATE INDEX "deployed_models_isActive_idx" ON "deployed_models"("isActive");

-- CreateIndex
CREATE INDEX "deployed_models_modelType_idx" ON "deployed_models"("modelType");

-- CreateIndex
CREATE UNIQUE INDEX "deployed_models_name_version_key" ON "deployed_models"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "training_configs_name_key" ON "training_configs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_data" ADD CONSTRAINT "training_data_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_data" ADD CONSTRAINT "training_data_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_evaluations" ADD CONSTRAINT "model_evaluations_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployed_models" ADD CONSTRAINT "deployed_models_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
