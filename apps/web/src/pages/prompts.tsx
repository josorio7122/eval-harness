import { useParams } from 'react-router'
import { PromptList } from '@/components/prompts/prompt-list'
import { PromptDetail } from '@/components/prompts/prompt-detail'

export function PromptsPage() {
  const { id } = useParams<{ id: string }>()
  return id ? <PromptDetail id={id} /> : <PromptList />
}
