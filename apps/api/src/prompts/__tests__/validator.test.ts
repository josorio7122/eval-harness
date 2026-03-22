import { describe, it, expect } from 'vitest'
import { playgroundSchema } from '../validator.js'

describe('playgroundSchema', () => {
  it('accepts valid first-message body', () => {
    const result = playgroundSchema.safeParse({
      versionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      messages: [{ role: 'user', content: 'Hello!' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid follow-up body with multiple messages', () => {
    const result = playgroundSchema.safeParse({
      versionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      messages: [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty messages array', () => {
    const result = playgroundSchema.safeParse({
      versionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      messages: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('Messages required')
    }
  })

  it('rejects messages where last entry has role assistant', () => {
    const result = playgroundSchema.safeParse({
      versionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      messages: [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('Last message must be from user')
    }
  })

  it('rejects non-UUID versionId', () => {
    const result = playgroundSchema.safeParse({
      versionId: 'not-a-uuid',
      messages: [{ role: 'user', content: 'Hello!' }],
    })
    expect(result.success).toBe(false)
  })
})
