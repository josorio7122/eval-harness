import { useNavigate } from 'react-router'
import { Database, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateDatasetDialog } from './create-dataset-dialog'
import { useDatasets } from '@/hooks/use-datasets'

export function DatasetList() {
  const navigate = useNavigate()
  const { data: datasets, isLoading } = useDatasets()

  function handleCreated(id: string) {
    navigate(`/datasets/${id}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--fg-primary)' }}>Datasets</h2>
        <CreateDatasetDialog
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
              New Dataset
            </Button>
          }
          onCreated={handleCreated}
        />
      </div>

      {/* Table header */}
      {!isLoading && datasets && datasets.length > 0 && (
        <div
          className="grid px-6 py-2.5 border-b"
          style={{
            gridTemplateColumns: '1fr auto',
            borderColor: 'var(--border-subtle)',
            background: 'var(--bg-surface-1)',
          }}
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
            Name
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-tertiary)',
            }}
          >
            Items / Attrs
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          // Shimmer loading rows
          <div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-6 py-3 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div
                  className="h-[13px] rounded animate-pulse"
                  style={{
                    width: `${120 + i * 40}px`,
                    background: 'var(--bg-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                />
                <div
                  className="h-[13px] w-8 rounded animate-pulse"
                  style={{
                    background: 'var(--bg-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                />
              </div>
            ))}
          </div>
        ) : !datasets || datasets.length === 0 ? (
          // Empty state
          <div
            className="flex flex-col items-center justify-center gap-4 m-6 p-10 rounded"
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              minHeight: '220px',
            }}
          >
            <Database size={32} style={{ color: 'var(--fg-muted)' }} />
            <div className="flex flex-col items-center gap-1">
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--fg-secondary)' }}>
                No datasets yet
              </p>
              <p style={{ fontSize: '12px', color: 'var(--fg-tertiary)' }}>
                Create a dataset to start organizing your eval cases.
              </p>
            </div>
            <CreateDatasetDialog
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
                  Create Dataset
                </Button>
              }
              onCreated={handleCreated}
            />
          </div>
        ) : (
          // Dataset rows
          <div>
            {datasets.map((dataset) => (
              <button
                key={dataset.id}
                onClick={() => navigate(`/datasets/${dataset.id}`)}
                className="w-full flex items-center justify-between px-6 py-3 border-b text-left transition-colors"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface-1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--fg-primary)', fontWeight: 500 }}>
                  {dataset.name}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--fg-tertiary)',
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {dataset._count?.items ?? '—'} items · {dataset.attributes.length} attr
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
