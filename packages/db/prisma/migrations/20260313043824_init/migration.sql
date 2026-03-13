-- CreateTable
CREATE TABLE "Dataset" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" TEXT[] DEFAULT ARRAY['input', 'expected_output']::TEXT[],

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetItem" (
    "id" UUID NOT NULL,
    "datasetId" UUID NOT NULL,
    "values" JSONB NOT NULL,

    CONSTRAINT "DatasetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grader" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rubric" TEXT NOT NULL,

    CONSTRAINT "Grader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "datasetId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentGrader" (
    "experimentId" UUID NOT NULL,
    "graderId" UUID NOT NULL,

    CONSTRAINT "ExperimentGrader_pkey" PRIMARY KEY ("experimentId","graderId")
);

-- CreateTable
CREATE TABLE "ExperimentResult" (
    "id" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "datasetItemId" UUID NOT NULL,
    "graderId" UUID NOT NULL,
    "verdict" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ExperimentResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_name_key" ON "Dataset"("name");

-- CreateIndex
CREATE INDEX "DatasetItem_datasetId_idx" ON "DatasetItem"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "Grader_name_key" ON "Grader"("name");

-- CreateIndex
CREATE INDEX "Experiment_datasetId_idx" ON "Experiment"("datasetId");

-- CreateIndex
CREATE INDEX "ExperimentGrader_graderId_idx" ON "ExperimentGrader"("graderId");

-- CreateIndex
CREATE INDEX "ExperimentResult_experimentId_idx" ON "ExperimentResult"("experimentId");

-- CreateIndex
CREATE INDEX "ExperimentResult_datasetItemId_idx" ON "ExperimentResult"("datasetItemId");

-- CreateIndex
CREATE INDEX "ExperimentResult_graderId_idx" ON "ExperimentResult"("graderId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentResult_experimentId_datasetItemId_graderId_key" ON "ExperimentResult"("experimentId", "datasetItemId", "graderId");

-- AddForeignKey
ALTER TABLE "DatasetItem" ADD CONSTRAINT "DatasetItem_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentGrader" ADD CONSTRAINT "ExperimentGrader_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentGrader" ADD CONSTRAINT "ExperimentGrader_graderId_fkey" FOREIGN KEY ("graderId") REFERENCES "Grader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_datasetItemId_fkey" FOREIGN KEY ("datasetItemId") REFERENCES "DatasetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_graderId_fkey" FOREIGN KEY ("graderId") REFERENCES "Grader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
