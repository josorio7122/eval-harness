-- AlterTable: change ExperimentResult.grader onDelete from CASCADE to RESTRICT
DO $$ BEGIN
  ALTER TABLE "ExperimentResult" DROP CONSTRAINT IF EXISTS "ExperimentResult_graderId_fkey";
  ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_graderId_fkey"
    FOREIGN KEY ("graderId") REFERENCES "Grader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN others THEN NULL;
END $$;
