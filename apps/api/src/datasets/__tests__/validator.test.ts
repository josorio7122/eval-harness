import { describe, it, expect } from 'vitest'
import { createDatasetSchema, addAttributeSchema, createItemSchema } from '../validator.js'

describe('createDatasetSchema', () => {
  it('accepts valid name', () => {
    const result = createDatasetSchema.safeParse({ name: 'my-dataset' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createDatasetSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only name', () => {
    const result = createDatasetSchema.safeParse({ name: '   ' })
    expect(result.success).toBe(false)
  })

  it('trims name', () => {
    const result = createDatasetSchema.safeParse({ name: '  my-dataset  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('my-dataset')
  })
})

describe('addAttributeSchema', () => {
  it('accepts valid name and lowercases it', () => {
    const result = addAttributeSchema.safeParse({ name: 'Context' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('context')
  })

  it('rejects empty name', () => {
    const result = addAttributeSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('createItemSchema', () => {
  it('accepts valid values', () => {
    const result = createItemSchema.safeParse({
      values: { input: 'hello', expected_output: 'world' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-string values', () => {
    const result = createItemSchema.safeParse({ values: { input: 123 } })
    expect(result.success).toBe(false)
  })
})
