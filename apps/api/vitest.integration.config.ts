import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    globalSetup: ['src/__tests__/integration/global-setup.ts'],
    setupFiles: ['src/__tests__/integration/setup.ts'],
    testTimeout: 30000,
    sequence: { sequential: true },
  },
})
