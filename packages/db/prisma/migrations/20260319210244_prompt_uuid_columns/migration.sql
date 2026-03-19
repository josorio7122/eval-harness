/*
  Warnings:

  - The primary key for the `Prompt` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PromptVersion` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `Prompt` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `PromptVersion` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `promptId` on the `PromptVersion` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
DO $$ BEGIN
  ALTER TABLE "PromptVersion" DROP CONSTRAINT "PromptVersion_promptId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- AlterTable Prompt: drop old text PK, add UUID PK
DO $$ BEGIN
  ALTER TABLE "Prompt" DROP CONSTRAINT "Prompt_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Prompt" DROP COLUMN "id";
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Prompt" ADD COLUMN "id" UUID NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable PromptVersion: drop old text PK and promptId, add UUID versions
DO $$ BEGIN
  ALTER TABLE "PromptVersion" DROP CONSTRAINT "PromptVersion_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PromptVersion" DROP COLUMN "id";
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PromptVersion" ADD COLUMN "id" UUID NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PromptVersion" DROP COLUMN "promptId";
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PromptVersion" ADD COLUMN "promptId" UUID NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromptVersion_promptId_idx" ON "PromptVersion"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PromptVersion_promptId_version_key" ON "PromptVersion"("promptId", "version");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
