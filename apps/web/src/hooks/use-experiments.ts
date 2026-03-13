import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export interface ExperimentGrader {
  experimentId: string
  graderId: string
  grader: { id: string; name: string; rubric: string }
}

export interface ExperimentResult {
  id: string
  experimentId: string
  datasetRevisionItemId: string
  graderId: string
  verdict: 'pass' | 'fail' | 'error'
  reason: string
}

export interface Experiment {
  id: string
  name: string
  datasetId: string
  status: 'queued' | 'running' | 'complete' | 'failed'
  dataset?: {
    id: string
    name: string
    attributes: string[]
    items: Array<{ id: string; values: Record<string, string> }>
  }
  graders?: ExperimentGrader[]
  results?: ExperimentResult[]
  _count?: { results: number }
  revision?: {
    schemaVersion: number
    createdAt: string
  }
}

export function useExperiments() {
  return useQuery({
    queryKey: ['experiments'],
    queryFn: () =>
      api.get<{ success: true; data: Experiment[] }>('/experiments').then((r) => r.data),
  })
}

export function useExperiment(id: string | undefined) {
  return useQuery({
    queryKey: ['experiments', id],
    queryFn: () =>
      api.get<{ success: true; data: Experiment }>(`/experiments/${id}`).then((r) => r.data),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' || status === 'queued' ? 2000 : false
    },
  })
}

export function useCreateExperiment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; datasetId: string; graderIds: string[] }) =>
      api.post<{ success: true; data: Experiment }>('/experiments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments'] }),
  })
}

export function useRunExperiment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/experiments/${id}/run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments'] }),
  })
}

export function useDeleteExperiment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del(`/experiments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments'] }),
  })
}

export function useRerunExperiment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ success: true; data: Experiment }>(`/experiments/${id}/rerun`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments'] }),
  })
}

// SSE hook for live experiment updates
export function useExperimentSSE(experimentId: string | undefined, status: string | undefined) {
  const qc = useQueryClient()
  const [progress, setProgress] = useState({ cellsCompleted: 0, totalCells: 0 })

  useEffect(() => {
    if (!experimentId || status !== 'running') return

    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
    const es = new EventSource(`${apiUrl}/experiments/${experimentId}/events`)

    es.addEventListener('progress', (e) => {
      const progressData = JSON.parse(e.data)
      setProgress({
        cellsCompleted: progressData.cellsCompleted,
        totalCells: progressData.totalCells,
      })

      if (progressData.result) {
        qc.setQueryData(['experiments', experimentId], (old: Experiment | undefined) => {
          if (!old) return old
          const existingIds = new Set(old.results?.map((r) => r.id) ?? [])
          if (existingIds.has(progressData.result.id)) return old
          return {
            ...old,
            results: [...(old.results ?? []), progressData.result],
          }
        })
      }
    })

    es.addEventListener('completed', () => {
      qc.invalidateQueries({ queryKey: ['experiments', experimentId] })
      qc.invalidateQueries({ queryKey: ['experiments'] })
      es.close()
    })

    es.addEventListener('error', () => {
      qc.invalidateQueries({ queryKey: ['experiments', experimentId] })
      es.close()
    })

    return () => es.close()
  }, [experimentId, status, qc])

  return progress
}
