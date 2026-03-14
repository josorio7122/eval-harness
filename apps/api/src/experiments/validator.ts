import { z } from 'zod'
import { DEFAULT_MODEL_ID } from '@eval-harness/shared'

export const createExperimentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  datasetId: z.string().uuid('Invalid dataset ID'),
  graderIds: z
    .array(z.string().uuid('Invalid grader ID'))
    .min(1, 'At least one grader is required'),
  modelId: z.string().min(1).default(DEFAULT_MODEL_ID),
})
