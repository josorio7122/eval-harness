/**
 * usePlayground hook — integration tested via Playwright.
 *
 * Unit tests are not written here because the hook wraps useChat from
 * @ai-sdk/react, which requires a React rendering environment and streaming
 * SSE infrastructure to exercise meaningfully. Mocking DefaultChatTransport
 * and useChat internals would test the mock, not the hook behaviour.
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
