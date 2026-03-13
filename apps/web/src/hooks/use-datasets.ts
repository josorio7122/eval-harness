import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function downloadBlob(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface Dataset {
  id: string
  name: string
  attributes: string[]
  _count?: { items: number }
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

export function useDownloadCsvTemplate() {
  return useMutation({
    mutationFn: ({ datasetId, name }: { datasetId: string; name: string }) =>
      downloadBlob(`/datasets/${datasetId}/csv/template`, `${name}-template.csv`),
  })
}

export function useExportCsv() {
  return useMutation({
    mutationFn: ({ datasetId, name }: { datasetId: string; name: string }) =>
      downloadBlob(`/datasets/${datasetId}/csv/export`, `${name}.csv`),
  })
}

export interface CsvPreviewRow {
  [key: string]: string
}

export interface CsvPreview {
  headers: string[]
  rows: CsvPreviewRow[]
  totalRows: number
  skippedRows?: { row: number; reason: string }[]
  warnings?: string[]
}

export function usePreviewCsv() {
  return useMutation({
    mutationFn: async ({
      datasetId,
      file,
    }: {
      datasetId: string
      file: File
    }): Promise<CsvPreview> => {
      const csvContent = await file.text()
      const res = await fetch(`${API_URL}/datasets/${datasetId}/csv/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: csvContent,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Preview failed: ${res.status}` }))
        throw new Error(err.error ?? `Preview failed: ${res.status}`)
      }
      const json = await res.json()
      return json.data ?? json
    },
  })
}

export function useImportCsv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      datasetId,
      file,
    }: {
      datasetId: string
      file: File
    }) => {
      const csvContent = await file.text()
      const res = await fetch(`${API_URL}/datasets/${datasetId}/csv/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: csvContent,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Import failed: ${res.status}` }))
        throw new Error(err.error ?? `Import failed: ${res.status}`)
      }
      return res.json()
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ['datasets', vars.datasetId] }),
  })
}
