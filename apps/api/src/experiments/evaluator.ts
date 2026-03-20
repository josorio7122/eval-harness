import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import { buildSystemPrompt, buildUserMessage } from './judge-template.js'
import { logger } from '../lib/logger.js'

const verdictSchema = z.object({
  reason: z.string(),
  verdict: z.enum(['pass', 'fail']),
})

const openrouter = createOpenRouter({
  apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
})

export const evaluate = async (params: {
  rubric: string
  itemAttributes: Record<string, string>
  modelId: string
  output?: string
}): Promise<{ verdict: 'pass' | 'fail'; reason: string }> => {
  const { rubric, itemAttributes, modelId, output } = params

  logger.info({ modelId, hasOutput: output != null }, 'evaluator: calling judge model')

  const result = await generateObject({
    model: openrouter(modelId),
    schema: verdictSchema,
    messages: [
      { role: 'system', content: buildSystemPrompt(rubric) },
      { role: 'user', content: buildUserMessage(itemAttributes, output) },
    ],
  })

  logger.info({ modelId, verdict: result.object.verdict }, 'evaluator: verdict received')

  return result.object
}
