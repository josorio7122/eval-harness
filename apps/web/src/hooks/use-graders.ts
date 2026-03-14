import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Grader {
  id: string
  name: string
  description: string
  rubric: string
}

export function useGraders() {
  return useQuery({
    queryKey: ['graders'],
    queryFn: () => api.get<Grader[]>('/graders'),
  })
}

export function useGrader(id: string | undefined) {
  return useQuery({
    queryKey: ['graders', id],
    queryFn: () => api.get<Grader>(`/graders/${id}`),
    enabled: !!id,
  })
}

export function useCreateGrader() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description: string; rubric: string }) =>
      api.post('/graders', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['graders'] }),
  })
}

export function useUpdateGrader() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
      name?: string
      description?: string
      rubric?: string
    }) => api.patch(`/graders/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['graders'] })
      qc.invalidateQueries({ queryKey: ['graders', vars.id] })
    },
  })
}

export function useDeleteGrader() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del(`/graders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['graders'] }),
  })
}
