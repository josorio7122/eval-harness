import { z } from 'zod'

export const createExperimentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  datasetId: z.string().uuid('Invalid dataset ID'),
  graderIds: z
    .array(z.string().uuid('Invalid grader ID'))
    .min(1, 'At least one grader is required'),
})
