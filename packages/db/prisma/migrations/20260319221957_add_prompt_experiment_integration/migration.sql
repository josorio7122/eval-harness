-- AlterTable: add promptVersionId to Experiment
DO $$ BEGIN
  ALTER TABLE "Experiment" ADD COLUMN "promptVersionId" UUID NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ExperimentOutput" (
    "id" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "datasetRevisionItemId" UUID NOT NULL,
    "output" TEXT NOT NULL DEFAULT '',
    "error" TEXT,

    CONSTRAINT "ExperimentOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExperimentOutput_experimentId_idx" ON "ExperimentOutput"("experimentId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExperimentOutput_experimentId_datasetRevisionItemId_key" ON "ExperimentOutput"("experimentId", "datasetRevisionItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Experiment_promptVersionId_idx" ON "Experiment"("promptVersionId");

-- AddForeignKey: Experiment -> PromptVersion
DO $$ BEGIN
  ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: ExperimentOutput -> Experiment
DO $$ BEGIN
  ALTER TABLE "ExperimentOutput" ADD CONSTRAINT "ExperimentOutput_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: ExperimentOutput -> DatasetRevisionItem
DO $$ BEGIN
  ALTER TABLE "ExperimentOutput" ADD CONSTRAINT "ExperimentOutput_datasetRevisionItemId_fkey" FOREIGN KEY ("datasetRevisionItemId") REFERENCES "DatasetRevisionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
