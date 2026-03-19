import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface PromptVersion {
  id: string
  version: number
  systemPrompt: string
  userPrompt: string
  modelId: string
  modelParams: { temperature?: number; maxTokens?: number; topP?: number }
  createdAt: string
}

export interface Prompt {
  id: string
  name: string
  versionCount: number
  latestVersion: PromptVersion
}

export interface PromptWithVersions {
  id: string
  name: string
  versions: PromptVersion[]
}

export function usePrompts() {
  return useQuery({
    queryKey: ['prompts'],
    queryFn: () => api.get<Prompt[]>('/prompts'),
  })
}

export function usePrompt(id: string | undefined) {
  return useQuery({
    queryKey: ['prompts', id],
    queryFn: () => api.get<PromptWithVersions>(`/prompts/${id}`),
    enabled: !!id,
  })
}

export function useCreatePrompt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      systemPrompt: string
      userPrompt: string
      modelId: string
      modelParams?: { temperature?: number; maxTokens?: number; topP?: number }
    }) => api.post('/prompts', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prompts'] }),
  })
}

export function useUpdatePromptName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string }) =>
      api.patch(`/prompts/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['prompts'] })
      qc.invalidateQueries({ queryKey: ['prompts', vars.id] })
    },
  })
}

export function useCreatePromptVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
      systemPrompt: string
      userPrompt: string
      modelId: string
      modelParams?: { temperature?: number; maxTokens?: number; topP?: number }
    }) => api.post(`/prompts/${id}/versions`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['prompts'] })
      qc.invalidateQueries({ queryKey: ['prompts', vars.id] })
    },
  })
}

export function useDeletePrompt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del(`/prompts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prompts'] }),
  })
}
