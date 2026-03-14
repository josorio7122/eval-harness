import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { buildSystemPrompt, buildUserMessage } from './judge-template.js'

const verdictSchema = z.object({
  reason: z.string(),
  verdict: z.enum(['pass', 'fail']),
})

const openrouter = createOpenRouter({
  apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
})

export const evaluate = async (
  rubric: string,
  itemAttributes: Record<string, string>,
): Promise<{ verdict: 'pass' | 'fail'; reason: string }> => {
  const model = process.env['LLM_JUDGE_MODEL'] ?? 'google/gemini-3.1-flash-lite-preview'

  const result = await generateText({
    model: openrouter(model),
    output: Output.object({ schema: verdictSchema }),
    messages: [
      { role: 'system', content: buildSystemPrompt(rubric) },
      { role: 'user', content: buildUserMessage(itemAttributes) },
    ],
  })

  return result.output
}
