/**
 * usePlayground hook — integration tested via Playwright (Task 13).
 *
 * Unit tests are not written here because:
 * 1. The hook wraps useChat from @ai-sdk/react, which requires a React
 *    rendering environment and streaming SSE infrastructure to exercise
 *    meaningfully.
 * 2. No @testing-library/react is installed in this project — there are
 *    no other hook unit tests to follow as a pattern.
 * 3. Mocking DefaultChatTransport + useChat internals would test the
 *    mock, not the hook behaviour.
 *
 * Behavioural coverage is provided by the Playwright smoke tests in Task 13.
 */

// Ensure the module is importable and types are correct at compile time.
import { usePlayground } from './use-playground'

// Vitest picks this up; it passes trivially but proves the module compiles.
import { describe, it, expect } from 'vitest'

describe('usePlayground', () => {
  it('exports usePlayground as a function', () => {
    expect(typeof usePlayground).toBe('function')
  })
})
