import { z } from 'zod'

export const createGraderSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().default(''),
  rubric: z.string().trim().min(1, 'Rubric is required'),
})

export const updateGraderSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').optional(),
    description: z.string().optional(),
    rubric: z.string().trim().min(1, 'Rubric is required').optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined || data.description !== undefined || data.rubric !== undefined,
    { message: 'At least one field must be provided' },
  )
