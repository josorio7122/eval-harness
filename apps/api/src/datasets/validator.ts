import { z } from 'zod'

export const createDatasetSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
})

export const updateDatasetSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
})

export const addAttributeSchema = z.object({
  name: z.string().trim().min(1, 'Attribute name is required').transform((v) => v.toLowerCase()),
})

export const createItemSchema = z.object({
  values: z.record(z.string(), z.string()),
})

export const updateItemSchema = z.object({
  values: z.record(z.string(), z.string()),
})
