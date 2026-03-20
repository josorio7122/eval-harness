import { expect } from 'vitest'
import { type Result } from '@eval-harness/shared'

/** Extract data from Result, fail test if not successful */
export function unwrap<T>(result: Result<T>): T {
  if (!result.success) {
    expect.unreachable(`unwrap failed: ${result.error}`)
  }
  return result.data
}
