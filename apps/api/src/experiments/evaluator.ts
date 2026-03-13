import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import { z } from 'zod'

const verdictSchema = z.object({
  verdict: z.enum(['pass', 'fail']),
  reason: z.string(),
})

const openrouter = createOpenRouter({
  apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
})

export const evaluate = async (
  rubric: string,
  itemAttributes: Record<string, string>,
): Promise<{ verdict: 'pass' | 'fail'; reason: string }> => {
  const model = process.env['LLM_JUDGE_MODEL'] ?? 'google/gemini-2.5-flash-preview'

  const prompt = Object.entries(itemAttributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  const result = await generateText({
    model: openrouter(model),
    output: Output.object({ schema: verdictSchema }),
    system: rubric,
    prompt,
  })

  return result.output
}
