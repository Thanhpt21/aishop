/*
  Warnings:

  - You are about to drop the `_ExampleQAToTrainingSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deployed_models` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `model_evaluations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `training_configs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `training_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `training_data_exports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `training_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ExampleQAToTrainingSession" DROP CONSTRAINT "_ExampleQAToTrainingSession_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExampleQAToTrainingSession" DROP CONSTRAINT "_ExampleQAToTrainingSession_B_fkey";

-- DropForeignKey
ALTER TABLE "deployed_models" DROP CONSTRAINT "deployed_models_trainingSessionId_fkey";

-- DropForeignKey
ALTER TABLE "model_evaluations" DROP CONSTRAINT "model_evaluations_trainingSessionId_fkey";

-- DropForeignKey
ALTER TABLE "training_data" DROP CONSTRAINT "training_data_messageId_fkey";

-- DropForeignKey
ALTER TABLE "training_data" DROP CONSTRAINT "training_data_trainingSessionId_fkey";

-- DropForeignKey
ALTER TABLE "training_sessions" DROP CONSTRAINT "training_sessions_userId_fkey";

-- DropTable
DROP TABLE "_ExampleQAToTrainingSession";

-- DropTable
DROP TABLE "deployed_models";

-- DropTable
DROP TABLE "model_evaluations";

-- DropTable
DROP TABLE "training_configs";

-- DropTable
DROP TABLE "training_data";

-- DropTable
DROP TABLE "training_data_exports";

-- DropTable
DROP TABLE "training_sessions";
