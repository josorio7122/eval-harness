import { describe, it, expect } from 'vitest'
import { ok, fail, tryCatch } from '../result.js'

describe('ok', () => {
  it('wraps a value in a successful Result', () => {
    const result = ok(42)
    expect(result).toEqual({ success: true, data: 42 })
  })
})

describe('fail', () => {
  it('wraps an error in a failed Result', () => {
    const result = fail('something went wrong')
    expect(result).toEqual({ success: false, error: 'something went wrong' })
  })
})

describe('tryCatch', () => {
  it('returns the Result when fn succeeds', async () => {
    const result = await tryCatch(async () => ok('value'))
    expect(result).toEqual({ success: true, data: 'value' })
  })

  it('catches a generic Error and returns fail with its message', async () => {
    const result = await tryCatch(async () => {
      throw new Error('something exploded')
    })
    expect(result).toEqual({ success: false, error: 'something exploded' })
  })

  it('catches a NotFoundError and returns fail("Record not found")', async () => {
    const result = await tryCatch(async () => {
      const e = new Error('prisma full stack trace...')
      e.name = 'NotFoundError'
      throw e
    })
    expect(result).toEqual({ success: false, error: 'Record not found' })
  })

  it('catches an error with code P2025 and returns fail("Record not found")', async () => {
    const result = await tryCatch(async () => {
      const e = Object.assign(new Error('prisma full stack trace...'), { code: 'P2025' })
      throw e
    })
    expect(result).toEqual({ success: false, error: 'Record not found' })
  })

  it('returns fail("Unknown error") for non-Error throws', async () => {
    const result = await tryCatch(async () => {
      throw 'raw string error'
    })
    expect(result).toEqual({ success: false, error: 'Unknown error' })
  })
})
