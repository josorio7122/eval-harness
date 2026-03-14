-- Add deletedAt to Dataset
DO $$ BEGIN
  ALTER TABLE "Dataset" ADD COLUMN "deletedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add deletedAt to Grader  
DO $$ BEGIN
  ALTER TABLE "Grader" ADD COLUMN "deletedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add deletedAt to Experiment
DO $$ BEGIN
  ALTER TABLE "Experiment" ADD COLUMN "deletedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Drop old unique constraints on name fields
DROP INDEX IF EXISTS "Dataset_name_key";
DROP INDEX IF EXISTS "Grader_name_key";

-- Create partial unique indexes (only active records)
CREATE UNIQUE INDEX IF NOT EXISTS "Dataset_name_active_key" ON "Dataset" ("name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Grader_name_active_key" ON "Grader" ("name") WHERE "deletedAt" IS NULL;

-- Change Experiment -> Dataset cascade from CASCADE to RESTRICT
-- Drop existing FK constraint and recreate with RESTRICT
DO $$ BEGIN
  ALTER TABLE "Experiment" DROP CONSTRAINT IF EXISTS "Experiment_datasetId_fkey";
  ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_datasetId_fkey" 
    FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN others THEN NULL;
END $$;
