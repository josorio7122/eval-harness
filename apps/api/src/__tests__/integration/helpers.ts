import { expect } from 'vitest'
import { type Result } from '@eval-harness/shared'
import { createPromptRepository } from '../../prompts/repository.js'
import { prisma } from '../../lib/prisma.js'

const promptRepo = createPromptRepository(prisma)

let counter = 0

/** Extract data from Result, fail test if not successful */
export function unwrap<T>(result: Result<T>): T {
  if (!result.success) {
    expect.unreachable(`unwrap failed: ${result.error}`)
  }
  return result.data
}

/** Generate a unique string for test data names */
export function uid(prefix = 'test') {
  return `${prefix}-${Date.now()}-${++counter}`
}

/** Create a prompt with a version containing {input} placeholder */
export async function seedPrompt(modelId = 'openai/gpt-4o') {
  return unwrap(
    await promptRepo.create({
      name: uid('prompt'),
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Answer the following: {input}',
      modelId,
    }),
  )
}
