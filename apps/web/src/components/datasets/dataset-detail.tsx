import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Plus, Trash2, Pencil, Download, Upload, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddAttributeDialog } from './add-attribute-dialog'
import { AddItemDialog, EditItemDialog } from './add-item-dialog'
import { RevisionHistory } from './revision-history'
import {
  useDataset,
  useUpdateDataset,
  useRemoveAttribute,
  useDeleteItem,
  useDeleteDataset,
  useDownloadCsvTemplate,
  useExportCsv,
  usePreviewCsv,
  useImportCsv,
} from '@/hooks/use-datasets'
import type { DatasetItem, CsvPreview } from '@/hooks/use-datasets'
import { useExperiments } from '@/hooks/use-experiments'

interface DatasetDetailProps {
  id: string
}

export function DatasetDetail({ id }: DatasetDetailProps) {
  const navigate = useNavigate()
  const { data: dataset, isLoading } = useDataset(id)
  const updateDataset = useUpdateDataset()
  const removeAttr = useRemoveAttribute()
  const deleteItem = useDeleteItem()
  const deleteDataset = useDeleteDataset()
  const downloadTemplate = useDownloadCsvTemplate()
  const exportCsv = useExportCsv()
  const previewCsv = usePreviewCsv()
  const importCsv = useImportCsv()
  const { data: allExperiments } = useExperiments()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<'items' | 'history'>('items')
  const [editItem, setEditItem] = useState<DatasetItem | undefined>(undefined)
  const [editOpen, setEditOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const [removeAttrError, setRemoveAttrError] = useState('')

  useEffect(() => {
    if (dataset) setNameValue(dataset.name)
  }, [dataset?.name])

  function startEditName() {
    setNameValue(dataset?.name ?? '')
    setEditingName(true)
    setTimeout(() => {
      nameInputRef.current?.select()
    }, 0)
  }

  async function commitNameEdit() {
    if (!dataset) return
    setEditingName(false)
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === dataset.name) return
    try {
      await updateDataset.mutateAsync({ id, name: trimmed })
      setRenameError('')
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename dataset.')
    }
  }

  function cancelNameEdit() {
    setNameValue(dataset?.name ?? '')
    setEditingName(false)
  }

  const affectedExperiments = (allExperiments ?? []).filter(
    (exp) => exp.datasetId === id,
  )

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center gap-3 px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div
            className="h-4 w-32 animate-pulse rounded"
            style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-sm)' }}
          />
        </div>
        <div className="flex flex-1">
          <div
            className="w-[30%] border-r p-4 flex flex-col gap-2"
            style={{ borderColor: 'var(--border-default)' }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[28px] animate-pulse rounded"
                style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-sm)' }}
              />
            ))}
          </div>
          <div className="flex-1 p-4" />
        </div>
      </div>
    )
  }

  if (!dataset) {
    return (
      <div className="p-6" style={{ color: 'var(--fg-secondary)' }}>
        Dataset not found.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <button
          onClick={() => navigate('/datasets')}
          className="flex items-center gap-1 transition-colors"
          style={{
            color: 'var(--fg-tertiary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--fg-secondary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--fg-tertiary)'
          }}
        >
          <ArrowLeft size={14} />
        </button>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--fg-tertiary)',
          }}
        >
          /
        </span>
        {editingName ? (
          <input
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
            style={{
              flex: 1,
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--fg-primary)',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border-focus)',
              outline: 'none',
              padding: '0 2px',
              lineHeight: 1.4,
            }}
          />
        ) : (
          <h2
            onClick={startEditName}
            title="Click to rename"
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--fg-primary)',
              flex: 1,
              cursor: 'text',
              margin: 0,
            }}
          >
            {dataset.name}
          </h2>
        )}

        {/* CSV actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Download Template */}
          <button
            onClick={() => downloadTemplate.mutate({ datasetId: id, name: dataset.name })}
            disabled={downloadTemplate.isPending}
            title="Download CSV template"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '28px',
              padding: '0 10px',
              fontSize: '11px',
              fontWeight: 500,
              background: 'var(--bg-surface-2)',
              color: 'var(--fg-secondary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              opacity: downloadTemplate.isPending ? 0.5 : 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
          >
            <FileDown size={12} />
            Template
          </button>

          {/* Import CSV */}
          <button
            onClick={() => {
              setCsvPreview(null)
              setImportFile(null)
              setImportDialogOpen(true)
            }}
            title="Import from CSV"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '28px',
              padding: '0 10px',
              fontSize: '11px',
              fontWeight: 500,
              background: 'var(--bg-surface-2)',
              color: 'var(--fg-secondary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
          >
            <Upload size={12} />
            Import CSV
          </button>

          {/* Export CSV */}
          <button
            onClick={() => exportCsv.mutate({ datasetId: id, name: dataset.name })}
            disabled={exportCsv.isPending}
            title="Export to CSV"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '28px',
              padding: '0 10px',
              fontSize: '11px',
              fontWeight: 500,
              background: 'var(--bg-surface-2)',
              color: 'var(--fg-secondary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              opacity: exportCsv.isPending ? 0.5 : 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
          >
            <Download size={12} />
            Export CSV
          </button>

          {/* Delete Dataset */}
          <button
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteDataset.isPending}
            title="Delete dataset"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '28px',
              padding: '0 10px',
              fontSize: '11px',
              fontWeight: 500,
              background: 'var(--bg-surface-2)',
              color: 'var(--fg-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              opacity: deleteDataset.isPending ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fail-fg)'
              e.currentTarget.style.background = 'var(--fail-subtle)'
              e.currentTarget.style.borderColor = 'var(--fail)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-muted)'
              e.currentTarget.style.background = 'var(--bg-surface-2)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>

      {/* Rename error */}
      {renameError && (
        <div
          style={{
            padding: '6px 24px',
            fontSize: '12px',
            color: 'var(--error-fg)',
            background: 'var(--fail-subtle)',
            borderBottom: '1px solid var(--fail)',
          }}
        >
          {renameError}
        </div>
      )}

      {/* Delete Dataset Confirmation Dialog */}
      {deleteDialogOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteDialogOpen(false)
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface-1)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              width: '400px',
              maxWidth: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
              Delete dataset "{dataset.name}"?
            </h3>

            {affectedExperiments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '12px', color: 'var(--error-fg)', margin: 0 }}>
                  The following experiments reference this dataset and will also be deleted along with all their evaluation results:
                </p>
                <ul
                  style={{
                    margin: 0,
                    padding: '8px 12px',
                    background: 'var(--fail-subtle)',
                    border: '1px solid var(--fail)',
                    borderRadius: 'var(--radius-md)',
                    listStyleType: 'disc',
                    paddingLeft: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {affectedExperiments.map((exp) => (
                    <li key={exp.id} style={{ fontSize: '12px', color: 'var(--fail-fg)', fontFamily: 'var(--font-mono)' }}>
                      {exp.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', margin: 0 }}>
                All items, revision history, and any associated experiments with their results will be permanently deleted.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setDeleteDialogOpen(false)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  fontSize: '12px',
                  background: 'transparent',
                  color: 'var(--fg-secondary)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteDataset.mutateAsync(id)
                  setDeleteDialogOpen(false)
                  navigate('/datasets')
                }}
                disabled={deleteDataset.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '32px',
                  padding: '0 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: 'var(--fail-subtle)',
                  color: 'var(--fail-fg)',
                  border: '1px solid var(--fail)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  opacity: deleteDataset.isPending ? 0.6 : 1,
                }}
              >
                <Trash2 size={12} />
                {deleteDataset.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Dialog */}
      {importDialogOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setImportDialogOpen(false)
              setCsvPreview(null)
              setImportFile(null)
            }
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface-1)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              width: '480px',
              maxWidth: '90vw',
              maxHeight: '70vh',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
                Import CSV
              </h3>
              <button
                onClick={() => {
                  setImportDialogOpen(false)
                  setCsvPreview(null)
                  setImportFile(null)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--fg-muted)',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '2px 4px',
                }}
              >
                ×
              </button>
            </div>

            {/* File picker */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImportFile(file)
                  setCsvPreview(null)
                  try {
                    const preview = await previewCsv.mutateAsync({ datasetId: id, file })
                    setCsvPreview(preview)
                  } catch {
                    // error shown via previewCsv.error
                  }
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  padding: '0 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: 'var(--bg-surface-2)',
                  color: 'var(--fg-primary)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
              >
                <Upload size={12} />
                {importFile ? importFile.name : 'Choose CSV file'}
              </button>
            </div>

            {/* Preview loading */}
            {previewCsv.isPending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fg-tertiary)', fontSize: '12px' }}>
                <Loader2 size={12} className="animate-spin" />
                Loading preview…
              </div>
            )}

            {/* Preview error */}
            {previewCsv.isError && (
              <p style={{ color: 'var(--error-fg)', fontSize: '12px', margin: 0 }}>
                {previewCsv.error instanceof Error ? previewCsv.error.message : 'Preview failed'}
              </p>
            )}

            {/* Preview table */}
            {csvPreview && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--fg-tertiary)' }}>
                    Preview — {csvPreview.validRowCount} rows
                  </span>
                </div>
                {csvPreview.skippedRows && csvPreview.skippedRows.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--error-fg)' }}>
                      {csvPreview.skippedRows.length} row{csvPreview.skippedRows.length > 1 ? 's' : ''} skipped:
                    </span>
                    {csvPreview.skippedRows.map(({ row, reason }) => (
                      <div
                        key={row}
                        style={{
                          fontSize: '11px',
                          color: 'var(--error-fg)',
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 8px',
                          background: 'var(--fail-subtle)',
                          border: '1px solid var(--fail)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        Row {row}: {reason}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ overflow: 'auto', maxHeight: '200px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface-2)' }}>
                        {csvPreview.headers.map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '4px 8px',
                              textAlign: 'left',
                              color: 'var(--fg-tertiary)',
                              fontWeight: 600,
                              borderBottom: '1px solid var(--border-subtle)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          {csvPreview.headers.map((h) => (
                            <td
                              key={h}
                              style={{
                                padding: '4px 8px',
                                color: 'var(--fg-secondary)',
                                fontFamily: 'var(--font-mono)',
                                maxWidth: '180px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row[h] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvPreview.validRowCount > 5 && (
                  <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
                    …and {csvPreview.validRowCount - 5} more rows
                  </span>
                )}
              </div>
            )}

            {/* Import error */}
            {importCsv.isError && (
              <p style={{ color: 'var(--error-fg)', fontSize: '12px', margin: 0 }}>
                {importCsv.error instanceof Error ? importCsv.error.message : 'Import failed'}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => {
                  setImportDialogOpen(false)
                  setCsvPreview(null)
                  setImportFile(null)
                }}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  fontSize: '12px',
                  background: 'transparent',
                  color: 'var(--fg-secondary)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!importFile) return
                  await importCsv.mutateAsync({ datasetId: id, file: importFile })
                  setImportDialogOpen(false)
                  setCsvPreview(null)
                  setImportFile(null)
                }}
                disabled={!csvPreview || importCsv.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '32px',
                  padding: '0 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: csvPreview ? 'var(--fg-primary)' : 'var(--bg-surface-2)',
                  color: csvPreview ? 'var(--fg-inverted)' : 'var(--fg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  cursor: csvPreview ? 'pointer' : 'not-allowed',
                  opacity: importCsv.isPending ? 0.6 : 1,
                }}
              >
                {importCsv.isPending ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Importing…
                  </>
                ) : (
                  'Confirm Import'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          borderBottom: '1px solid var(--border-default)',
          paddingLeft: '20px',
        }}
      >
        {(['items', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              height: '36px',
              padding: '0 14px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              color: activeTab === tab
                ? 'var(--fg-primary)'
                : 'var(--fg-tertiary)',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab) e.currentTarget.style.color = 'var(--fg-secondary)'
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab) e.currentTarget.style.color = 'var(--fg-tertiary)'
            }}
          >
            {tab === 'items' ? 'Items' : 'History'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'history' ? (
        <RevisionHistory datasetId={id} />
      ) : (
      /* Two-panel split */
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Schema panel (30%) */}
        <div
          className="flex flex-col border-r overflow-hidden"
          style={{
            width: '30%',
            minWidth: '200px',
            maxWidth: '320px',
            borderColor: 'var(--border-default)',
          }}
        >
          {/* Schema header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
              }}
            >
              Schema
            </span>
            <AddAttributeDialog
              datasetId={id}
              trigger={
                <button
                  className="flex items-center gap-1 transition-colors"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--fg-tertiary)',
                    fontSize: '11px',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--fg-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--fg-tertiary)'
                  }}
                >
                  <Plus size={12} />
                  Add
                </button>
              }
            />
          </div>

          {/* Attribute remove error */}
          {removeAttrError && (
            <div
              style={{
                padding: '6px 16px',
                fontSize: '11px',
                color: 'var(--error-fg)',
                background: 'var(--fail-subtle)',
                borderBottom: '1px solid var(--fail)',
              }}
            >
              {removeAttrError}
            </div>
          )}

          {/* Attribute list */}
          <div className="flex-1 overflow-auto">
            {dataset.attributes.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 p-6 text-center"
                style={{ color: 'var(--fg-muted)', fontSize: '12px' }}
              >
                <p>No attributes defined.</p>
                <AddAttributeDialog
                  datasetId={id}
                  trigger={
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--accent)',
                        fontSize: '12px',
                        textDecoration: 'underline',
                      }}
                    >
                      Add the first attribute
                    </button>
                  }
                />
              </div>
            ) : (
              dataset.attributes.map((attr) => (
                <AttributeRow
                  key={attr}
                  name={attr}
                  protected={attr === 'input' || attr === 'expected_output'}
                  onDelete={() => {
                    setRemoveAttrError('')
                    removeAttr.mutate(
                      { datasetId: id, name: attr },
                      { onError: (err) => setRemoveAttrError(err instanceof Error ? err.message : 'Failed to remove attribute.') },
                    )
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Items table (70%) */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Items header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
              }}
            >
              Items{' '}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ({dataset.items.length})
              </span>
            </span>
            <AddItemDialog
              datasetId={id}
              attributes={dataset.attributes}
              trigger={
                <button
                  className="flex items-center gap-1 transition-colors"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--fg-tertiary)',
                    fontSize: '11px',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--fg-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--fg-tertiary)'
                  }}
                >
                  <Plus size={12} />
                  Add
                </button>
              }
            />
          </div>

          {/* Items table */}
          <div className="flex-1 overflow-auto">
            {dataset.attributes.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 p-10 m-6 text-center"
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  minHeight: '160px',
                  color: 'var(--fg-muted)',
                  fontSize: '12px',
                }}
              >
                <p>Add attributes to define the schema before adding items.</p>
              </div>
            ) : dataset.items.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-3 p-10 m-6 text-center"
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  minHeight: '160px',
                }}
              >
                <p style={{ color: 'var(--fg-secondary)', fontSize: '13px', fontWeight: 500 }}>
                  No items yet
                </p>
                <p style={{ color: 'var(--fg-tertiary)', fontSize: '12px' }}>
                  Add items to populate this dataset.
                </p>
                <AddItemDialog
                  datasetId={id}
                  attributes={dataset.attributes}
                  trigger={
                    <Button
                      size="sm"
                      style={{
                        background: 'var(--bg-surface-2)',
                        color: 'var(--fg-primary)',
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      <Plus size={14} />
                      Add Item
                    </Button>
                  }
                />
              </div>
            ) : (
              <table
                className="w-full"
                style={{ borderCollapse: 'collapse' }}
              >
                <thead>
                  <tr style={{ background: 'var(--bg-surface-1)' }}>
                    {dataset.attributes.map((attr) => (
                      <th
                        key={attr}
                        className="px-4 py-2 text-left border-b"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--fg-tertiary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {attr}
                      </th>
                    ))}
                    <th
                      className="px-4 py-2 border-b"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        width: '60px',
                      }}
                    />
                  </tr>
                </thead>
                <tbody>
                  {dataset.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      attributes={dataset.attributes}
                      onEdit={() => {
                        setEditItem(item)
                        setEditOpen(true)
                      }}
                      onDelete={() =>
                        deleteItem.mutate({ datasetId: id, itemId: item.id })
                      }
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Edit item dialog — controlled externally */}
      {editItem && (
        <EditItemDialog
          datasetId={id}
          item={editItem}
          attributes={dataset.attributes}
          open={editOpen}
          onOpenChange={(v) => {
            setEditOpen(v)
            if (!v) setEditItem(undefined)
          }}
        />
      )}
    </div>
  )
}

// ── Attribute Row ──────────────────────────────────────────────────────────────

function AttributeRow({ name, onDelete, protected: isProtected }: { name: string; onDelete: () => void; protected?: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b"
      style={{
        borderColor: 'var(--border-subtle)',
        background: hovered ? 'var(--bg-surface-1)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          fontSize: '12px',
          color: 'var(--fg-secondary)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {name}
      </span>
      {hovered && !isProtected && (
        <button
          onClick={onDelete}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--fg-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: '2px',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--fail-fg)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--fg-muted)'
          }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}

// ── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  attributes,
  onEdit,
  onDelete,
}: {
  item: DatasetItem
  attributes: string[]
  onEdit: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <tr
      style={{ background: hovered ? 'var(--bg-surface-1)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {attributes.map((attr) => (
        <td
          key={attr}
          className="px-4 py-2 border-b"
          style={{
            borderColor: 'var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--fg-secondary)',
            fontFamily: 'var(--font-mono)',
            maxWidth: '280px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.values[attr] ?? ''}
        </td>
      ))}
      <td
        className="px-4 py-2 border-b"
        style={{ borderColor: 'var(--border-subtle)', width: '60px' }}
      >
        {hovered && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fg-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--fg-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--fg-muted)'
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={onDelete}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fg-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--fail-fg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--fg-muted)'
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
