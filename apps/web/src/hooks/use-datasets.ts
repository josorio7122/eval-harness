import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Dataset {
  id: string
  name: string
  attributes: string[]
}

export interface DatasetItem {
  id: string
  datasetId: string
  values: Record<string, string>
}

export interface DatasetWithItems extends Dataset {
  items: DatasetItem[]
}

export function useDatasets() {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: () =>
      api.get<{ success: true; data: Dataset[] }>('/datasets').then((r) => r.data),
  })
}

export function useDataset(id: string | undefined) {
  return useQuery({
    queryKey: ['datasets', id],
    queryFn: () =>
      api
        .get<{ success: true; data: DatasetWithItems }>(`/datasets/${id}`)
        .then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateDataset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) => api.post('/datasets', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['datasets'] }),
  })
}

export function useUpdateDataset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string }) =>
      api.patch(`/datasets/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['datasets'] }),
  })
}

export function useDeleteDataset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del(`/datasets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['datasets'] }),
  })
}

export function useAddAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ datasetId, name }: { datasetId: string; name: string }) =>
      api.post(`/datasets/${datasetId}/attributes`, { name }),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['datasets', vars.datasetId] }),
  })
}

export function useRemoveAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ datasetId, name }: { datasetId: string; name: string }) =>
      api.del(`/datasets/${datasetId}/attributes/${name}`),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['datasets', vars.datasetId] }),
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      datasetId,
      values,
    }: {
      datasetId: string
      values: Record<string, string>
    }) => api.post(`/datasets/${datasetId}/items`, { values }),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['datasets', vars.datasetId] }),
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      datasetId,
      itemId,
      values,
    }: {
      datasetId: string
      itemId: string
      values: Record<string, string>
    }) => api.patch(`/datasets/${datasetId}/items/${itemId}`, { values }),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['datasets', vars.datasetId] }),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      datasetId,
      itemId,
    }: {
      datasetId: string
      itemId: string
    }) => api.del(`/datasets/${datasetId}/items/${itemId}`),
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['datasets', vars.datasetId] }),
  })
}
