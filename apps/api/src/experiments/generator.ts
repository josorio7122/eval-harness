import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'

const openrouter = createOpenRouter({
  apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
})

export type GenerateParams = {
  systemPrompt: string
  userPrompt: string
  modelId: string
  modelParams: Record<string, unknown>
  input: string
}

export type GenerateResult = {
  output: string
  error: string | null
}

export async function generateOutput(params: GenerateParams): Promise<GenerateResult> {
  const { systemPrompt, userPrompt, modelId, modelParams, input } = params

  const userMessage = userPrompt.replace(/\{input\}/g, input)

  try {
    const result = await generateText({
      model: openrouter(modelId),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      ...(modelParams.temperature != null && { temperature: modelParams.temperature as number }),
      ...(modelParams.maxTokens != null && {
        maxOutputTokens: modelParams.maxTokens as number,
      }),
      ...(modelParams.topP != null && { topP: modelParams.topP as number }),
    })
    return { output: result.text, error: null }
  } catch (err) {
    return { output: '', error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
