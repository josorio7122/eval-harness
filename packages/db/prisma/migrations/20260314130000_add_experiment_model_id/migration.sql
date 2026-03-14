-- Add modelId column to Experiment table
DO $$ BEGIN
  ALTER TABLE "Experiment" ADD COLUMN "modelId" TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
