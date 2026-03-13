/*
  Warnings:

  - You are about to drop the column `attributes` on the `Dataset` table. All the data in the column will be lost.
  - You are about to drop the column `datasetItemId` on the `ExperimentResult` table. All the data in the column will be lost.
  - You are about to drop the `DatasetItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[experimentId,datasetRevisionItemId,graderId]` on the table `ExperimentResult` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `datasetRevisionId` to the `Experiment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `datasetRevisionItemId` to the `ExperimentResult` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "DatasetItem" DROP CONSTRAINT IF EXISTS "DatasetItem_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "ExperimentResult" DROP CONSTRAINT IF EXISTS "ExperimentResult_datasetItemId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "ExperimentResult_datasetItemId_idx";

-- DropIndex
DROP INDEX IF EXISTS "ExperimentResult_experimentId_datasetItemId_graderId_key";

-- AlterTable
DO $$ BEGIN
  ALTER TABLE "Dataset" DROP COLUMN "attributes";
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- AlterTable
DO $$ BEGIN
  ALTER TABLE "Experiment" ADD COLUMN "datasetRevisionId" UUID NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- AlterTable
DO $$ BEGIN
  ALTER TABLE "ExperimentResult" DROP COLUMN "datasetItemId";
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExperimentResult" ADD COLUMN "datasetRevisionItemId" UUID NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- DropTable
DROP TABLE IF EXISTS "DatasetItem";

-- CreateTable
CREATE TABLE IF NOT EXISTS "DatasetRevision" (
    "id" UUID NOT NULL,
    "datasetId" UUID NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "attributes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DatasetRevisionItem" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "values" JSONB NOT NULL,

    CONSTRAINT "DatasetRevisionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DatasetRevision_datasetId_idx" ON "DatasetRevision"("datasetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DatasetRevisionItem_revisionId_idx" ON "DatasetRevisionItem"("revisionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DatasetRevisionItem_itemId_idx" ON "DatasetRevisionItem"("itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Experiment_datasetRevisionId_idx" ON "Experiment"("datasetRevisionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExperimentResult_datasetRevisionItemId_idx" ON "ExperimentResult"("datasetRevisionItemId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExperimentResult_experimentId_datasetRevisionItemId_graderI_key" ON "ExperimentResult"("experimentId", "datasetRevisionItemId", "graderId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "DatasetRevision" ADD CONSTRAINT "DatasetRevision_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "DatasetRevisionItem" ADD CONSTRAINT "DatasetRevisionItem_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_datasetRevisionId_fkey" FOREIGN KEY ("datasetRevisionId") REFERENCES "DatasetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_datasetRevisionItemId_fkey" FOREIGN KEY ("datasetRevisionItemId") REFERENCES "DatasetRevisionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
