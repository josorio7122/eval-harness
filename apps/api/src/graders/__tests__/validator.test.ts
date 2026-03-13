import { describe, it, expect } from 'vitest'
import { createGraderSchema, updateGraderSchema } from '../validator.js'

describe('createGraderSchema', () => {
  it('accepts valid grader', () => {
    const result = createGraderSchema.safeParse({
      name: 'my-grader',
      rubric: 'Score based on correctness',
    })
    expect(result.success).toBe(true)
  })

  it('defaults description to empty string', () => {
    const result = createGraderSchema.safeParse({
      name: 'my-grader',
      rubric: 'Score based on correctness',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.description).toBe('')
  })

  it('accepts explicit description', () => {
    const result = createGraderSchema.safeParse({
      name: 'my-grader',
      description: 'A grader for testing',
      rubric: 'Score based on correctness',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.description).toBe('A grader for testing')
  })

  it('rejects empty name', () => {
    const result = createGraderSchema.safeParse({
      name: '',
      rubric: 'Score based on correctness',
    })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only name', () => {
    const result = createGraderSchema.safeParse({
      name: '   ',
      rubric: 'Score based on correctness',
    })
    expect(result.success).toBe(false)
  })

  it('trims name', () => {
    const result = createGraderSchema.safeParse({
      name: '  my-grader  ',
      rubric: 'Score based on correctness',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('my-grader')
  })

  it('rejects empty rubric', () => {
    const result = createGraderSchema.safeParse({
      name: 'my-grader',
      rubric: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing rubric', () => {
    const result = createGraderSchema.safeParse({ name: 'my-grader' })
    expect(result.success).toBe(false)
  })
})

describe('updateGraderSchema', () => {
  it('accepts partial update with only name', () => {
    const result = updateGraderSchema.safeParse({ name: 'new-name' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with only rubric', () => {
    const result = updateGraderSchema.safeParse({ rubric: 'new rubric' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with only description', () => {
    const result = updateGraderSchema.safeParse({ description: 'new desc' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no-op update)', () => {
    const result = updateGraderSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = updateGraderSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty rubric when provided', () => {
    const result = updateGraderSchema.safeParse({ rubric: '' })
    expect(result.success).toBe(false)
  })
})
