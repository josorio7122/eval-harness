export const AVAILABLE_MODELS = [
  // Top-Tier Reasoning
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    tier: 'reasoning' as const,
  },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tier: 'reasoning' as const },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    tier: 'reasoning' as const,
  },
  {
    id: 'anthropic/claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'Anthropic',
    tier: 'reasoning' as const,
  },
  {
    id: 'mistralai/mistral-large-2512',
    name: 'Mistral Large 3',
    provider: 'Mistral',
    tier: 'reasoning' as const,
  },
  // Fast / Cost-Effective
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    tier: 'fast' as const,
  },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', tier: 'fast' as const },
  { id: 'openai/o4-mini', name: 'o4 Mini', provider: 'OpenAI', tier: 'fast' as const },
  {
    id: 'google/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    tier: 'fast' as const,
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    tier: 'fast' as const,
  },
  // Open Source
  {
    id: 'meta-llama/llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    tier: 'open-source' as const,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    tier: 'open-source' as const,
  },
  {
    id: 'deepseek/deepseek-chat-v3.1',
    name: 'DeepSeek V3.1',
    provider: 'DeepSeek',
    tier: 'open-source' as const,
  },
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'DeepSeek',
    tier: 'open-source' as const,
  },
  {
    id: 'mistralai/mistral-medium-3',
    name: 'Mistral Medium 3',
    provider: 'Mistral',
    tier: 'open-source' as const,
  },
]

export const MODEL_TIERS = [
  { key: 'reasoning', label: 'Top-Tier Reasoning' },
  { key: 'fast', label: 'Fast / Cost-Effective' },
  { key: 'open-source', label: 'Open Source' },
] as const

export function getModelDisplayName(modelId: string): string {
  return AVAILABLE_MODELS.find((m) => m.id === modelId)?.name ?? modelId
}
