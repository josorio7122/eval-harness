import { useRef, useState } from 'react'
import { Trash2, Download, Upload, FileDown, Pencil } from 'lucide-react'
import type { DatasetWithItems } from '@/hooks/use-datasets'
import type { useUpdateDataset, useDownloadCsvTemplate, useExportCsv, useDeleteDataset } from '@/hooks/use-datasets'
import type { NavigateFunction } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/page-header'

interface DatasetHeaderProps {
  dataset: DatasetWithItems
  onImportClick: () => void
  onDeleteClick: () => void
  downloadTemplate: ReturnType<typeof useDownloadCsvTemplate>
  exportCsv: ReturnType<typeof useExportCsv>
  deleteDataset: ReturnType<typeof useDeleteDataset>
  updateDataset: ReturnType<typeof useUpdateDataset>
  navigate: NavigateFunction
}

export default function DatasetHeader({
  dataset,
  onImportClick,
  onDeleteClick,
  downloadTemplate,
  exportCsv,
  deleteDataset,
  updateDataset,
  navigate,
}: DatasetHeaderProps) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(dataset.name)
  const [syncedDatasetName, setSyncedDatasetName] = useState(dataset.name)
  const [renameError, setRenameError] = useState('')

  // Sync dataset name to local state when server data changes (derived-state pattern)
  if (dataset.name !== syncedDatasetName) {
    setSyncedDatasetName(dataset.name)
    setNameValue(dataset.name)
  }

  function startEditName() {
    setNameValue(dataset.name)
    setEditingName(true)
    setTimeout(() => {
      nameInputRef.current?.select()
    }, 0)
  }

  async function commitNameEdit() {
    setEditingName(false)
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === dataset.name) return
    try {
      await updateDataset.mutateAsync({ id: dataset.id, name: trimmed })
      setRenameError('')
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename dataset.')
    }
  }

  function cancelNameEdit() {
    setNameValue(dataset.name)
    setEditingName(false)
  }

  return (
    <>
      {/* Header */}
      <PageHeader onBack={() => navigate('/datasets')}>
        {editingName ? (
          <Input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => {
              setNameValue(e.target.value)
              setRenameError('')
            }}
            onBlur={commitNameEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitNameEdit()
              if (e.key === 'Escape') cancelNameEdit()
            }}
            className="text-lg font-semibold flex-1"
          />
        ) : (
          <h2
            onClick={startEditName}
            title="Click to rename"
            className="flex-1 text-lg font-semibold text-foreground cursor-text m-0 flex items-center gap-1.5 group"
          >
            {dataset.name}
            <Pencil size={13} className="opacity-0 group-hover:opacity-40 transition-opacity" />
          </h2>
        )}

        {/* CSV actions */}
        <div className="flex items-center gap-1.5">
          {/* Download Template */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate.mutate({ datasetId: dataset.id, name: dataset.name })}
            disabled={downloadTemplate.isPending}
            title="Download CSV template"
          >
            <FileDown size={12} />
            Template
          </Button>

          {/* Import CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={onImportClick}
            title="Import from CSV"
          >
            <Upload size={12} />
            Import CSV
          </Button>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv.mutate({ datasetId: dataset.id, name: dataset.name })}
            disabled={exportCsv.isPending}
            title="Export to CSV"
          >
            <Download size={12} />
            Export CSV
          </Button>

          {/* Delete Dataset */}
          <Button
            variant="outline"
            size="sm"
            onClick={onDeleteClick}
            disabled={deleteDataset.isPending}
            title="Delete dataset"
            className="text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={12} />
            Delete
          </Button>
        </div>
      </PageHeader>

      {/* Rename error */}
      {renameError && (
        <p className="text-destructive text-xs px-6 py-1">
          {renameError}
        </p>
      )}
    </>
  )
}
