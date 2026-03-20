import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'
import { z } from 'zod'
import { buildSystemPrompt, buildUserMessage } from './judge-template.js'

const verdictSchema = z.object({
  reason: z.string(),
  verdict: z.enum(['pass', 'fail']),
})

const openrouter = createOpenRouter({
  apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
})

function parseVerdict(text: string): { verdict: 'pass' | 'fail'; reason: string } {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = verdictSchema.parse(JSON.parse(jsonMatch[0]))
      return parsed
    } catch {
      // Fall through to text parsing
    }
  }

  // Fallback: look for pass/fail keywords in the text
  const lowerText = text.toLowerCase()
  const hasFail =
    lowerText.includes('"fail"') ||
    lowerText.includes('verdict: fail') ||
    lowerText.includes('verdict is fail')
  const hasPass =
    lowerText.includes('"pass"') ||
    lowerText.includes('verdict: pass') ||
    lowerText.includes('verdict is pass')

  if (hasFail) return { verdict: 'fail', reason: text.slice(0, 500) }
  if (hasPass) return { verdict: 'pass', reason: text.slice(0, 500) }

  throw new Error(`Could not parse verdict from response: ${text.slice(0, 200)}`)
}

export const evaluate = async (params: {
  rubric: string
  itemAttributes: Record<string, string>
  modelId: string
  output?: string
}): Promise<{ verdict: 'pass' | 'fail'; reason: string }> => {
  const { rubric, itemAttributes, modelId, output } = params

  const result = await generateText({
    model: openrouter(modelId),
    messages: [
      { role: 'system', content: buildSystemPrompt(rubric) },
      { role: 'user', content: buildUserMessage(itemAttributes, output) },
    ],
  })

  return parseVerdict(result.text)
}
