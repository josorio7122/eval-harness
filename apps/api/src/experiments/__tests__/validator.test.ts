import { describe, it, expect } from 'vitest'
import { createExperimentSchema } from '../validator.js'

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000'
const VALID_UUID_2 = '123e4567-e89b-42d3-a456-426614174001'
const VALID_UUID_3 = '123e4567-e89b-42d3-a456-426614174002'

describe('createExperimentSchema', () => {
  it('accepts valid experiment', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
      modelId: 'openai/gpt-4o',
      promptId: VALID_UUID_3,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createExperimentSchema.safeParse({
      name: '',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
    })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only name', () => {
    const result = createExperimentSchema.safeParse({
      name: '   ',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty graderIds array', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datasetId UUID', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: 'not-a-uuid',
      graderIds: [VALID_UUID_2],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid grader UUID in array', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts multiple valid grader UUIDs', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID, VALID_UUID_2],
      modelId: 'openai/gpt-4o',
      promptId: VALID_UUID_3,
    })
    expect(result.success).toBe(true)
  })

  it('trims name', () => {
    const result = createExperimentSchema.safeParse({
      name: '  My Experiment  ',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
      modelId: 'openai/gpt-4o',
      promptId: VALID_UUID_3,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('My Experiment')
  })

  it('rejects when modelId is missing', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
    })
    expect(result.success).toBe(false)
  })

  it('accepts a custom modelId string', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
      modelId: 'openai/gpt-4o',
      promptId: VALID_UUID_3,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.modelId).toBe('openai/gpt-4o')
  })

  it('rejects empty modelId string', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
      modelId: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when promptId is missing', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
      modelId: 'openai/gpt-4o',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid promptId UUID format', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
      modelId: 'openai/gpt-4o',
      promptId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid promptId with all other fields', () => {
    const result = createExperimentSchema.safeParse({
      name: 'My Experiment',
      datasetId: VALID_UUID,
      graderIds: [VALID_UUID_2],
      modelId: 'openai/gpt-4o',
      promptId: VALID_UUID_3,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.promptId).toBe(VALID_UUID_3)
  })
})
