import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Play, RotateCcw, Trash2, Loader2, Download } from 'lucide-react'
import {
  useExperiment,
  useRunExperiment,
  useRerunExperiment,
  useDeleteExperiment,
  useExperimentSSE,
} from '@/hooks/use-experiments'
import { ResultsTable } from './results-table'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function downloadExperimentCsv(id: string, name: string) {
  const res = await fetch(`${API_URL}/experiments/${id}/csv/export`)
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface ExperimentDetailProps {
  id: string
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'var(--neutral-fg)',
  running: 'var(--accent)',
  complete: 'var(--pass-fg)',
  failed: 'var(--error-fg)',
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  complete: 'Complete',
  failed: 'Failed',
}

export function ExperimentDetail({ id }: ExperimentDetailProps) {
  const navigate = useNavigate()
  const { data: experiment, isLoading } = useExperiment(id)
  const runExp = useRunExperiment()
  const rerunExp = useRerunExperiment()
  const deleteExp = useDeleteExperiment()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  // SSE: live cell updates while running
  const progress = useExperimentSSE(id, experiment?.status)

  const isRunning = experiment?.status === 'running' || experiment?.status === 'queued'
  const isComplete = experiment?.status === 'complete'

  const hasResults =
    experiment?.results && experiment.results.length > 0

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center gap-3 px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div
            className="h-4 w-40 animate-pulse rounded"
            style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-sm)' }}
          />
        </div>
        <div
          className="flex flex-col gap-3 p-6"
          style={{ flex: 1 }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[44px] rounded animate-pulse"
              style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)' }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="p-6" style={{ color: 'var(--fg-secondary)' }}>
        Experiment not found.
      </div>
    )
  }

  async function handleDelete() {
    await deleteExp.mutateAsync(id)
    navigate('/experiments')
  }

  const totalCells =
    (experiment.dataset?.items?.length ?? 0) * (experiment.graders?.length ?? 0)
  const completedCells =
    isRunning && progress.totalCells > 0
      ? progress.cellsCompleted
      : experiment.results?.length ?? 0
  const progressPct = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <button
          onClick={() => navigate('/experiments')}
          className="flex items-center gap-1 transition-colors"
          style={{
            color: 'var(--fg-tertiary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-tertiary)')}
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
        <h2
          style={{ fontSize: '16px', fontWeight: 600, color: 'var(--fg-primary)', flex: 1, minWidth: 0 }}
          className="truncate"
        >
          {experiment.name}
        </h2>

        {/* Dataset name */}
        {experiment.dataset && (
          <span
            className="text-[12px] shrink-0"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            {experiment.dataset.name}
          </span>
        )}

        {/* Revision metadata */}
        {experiment.revision && (
          <>
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-tertiary)',
                flexShrink: 0,
              }}
            >
              Schema v{experiment.revision.schemaVersion}
            </span>
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-tertiary)',
                flexShrink: 0,
              }}
            >
              Pinned {new Date(experiment.revision.createdAt).toLocaleDateString()}
            </span>
          </>
        )}

        {/* Status badge */}
        <span
          className="shrink-0 text-[11px] font-medium"
          style={{ color: STATUS_COLOR[experiment.status] ?? 'var(--neutral-fg)' }}
        >
          {STATUS_LABEL[experiment.status] ?? experiment.status}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Run button — only when queued */}
          {experiment.status === 'queued' && (
            <button
              onClick={() => runExp.mutate(id)}
              disabled={runExp.isPending}
              className="flex items-center gap-1.5 h-[28px] px-3 text-[12px] font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--bg-surface-2)',
                color: 'var(--fg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
            >
              {runExp.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
              Run
            </button>
          )}

          {/* Running: live progress indicator */}
          {isRunning && (
            <div
              className="flex items-center gap-1.5 h-[28px] px-3 text-[12px]"
              style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
            >
              <Loader2 size={12} className="animate-spin" />
              {completedCells}/{totalCells}
            </div>
          )}

          {/* Re-run — only when complete or failed */}
          {(isComplete || experiment.status === 'failed') && (
            <button
              onClick={() => rerunExp.mutate(id)}
              disabled={rerunExp.isPending}
              className="flex items-center gap-1.5 h-[28px] px-3 text-[12px] font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--bg-surface-2)',
                color: 'var(--fg-secondary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
            >
              {rerunExp.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RotateCcw size={12} />
              )}
              Re-run
            </button>
          )}

          {/* Export CSV — only when complete */}
          {isComplete && (
            <button
              onClick={async () => {
                setExportingCsv(true)
                try {
                  await downloadExperimentCsv(id, experiment.name)
                } finally {
                  setExportingCsv(false)
                }
              }}
              disabled={exportingCsv}
              className="flex items-center gap-1.5 h-[28px] px-3 text-[12px] font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--bg-surface-2)',
                color: 'var(--fg-secondary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
            >
              {exportingCsv ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              Export CSV
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleteExp.isPending}
            className="flex items-center gap-1.5 h-[28px] px-3 text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'var(--bg-surface-2)',
              color: 'var(--fg-secondary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fail-fg)'
              e.currentTarget.style.background = 'var(--fail-subtle)'
              e.currentTarget.style.borderColor = 'var(--fail)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-secondary)'
              e.currentTarget.style.background = 'var(--bg-surface-2)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>

      {/* Delete Experiment Confirmation Dialog */}
      {showDeleteDialog && (
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
            if (e.target === e.currentTarget) setShowDeleteDialog(false)
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
              Delete experiment "{experiment.name}"?
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', margin: 0 }}>
              This will permanently delete this experiment and all its results.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowDeleteDialog(false)}
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
                  setShowDeleteDialog(false)
                  await handleDelete()
                }}
                disabled={deleteExp.isPending}
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
                  opacity: deleteExp.isPending ? 0.6 : 1,
                }}
              >
                <Trash2 size={12} />
                {deleteExp.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Running progress bar */}
      {isRunning && (
        <div
          style={{
            height: '2px',
            background: 'var(--bg-surface-2)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'var(--accent)',
              transition: 'width 400ms ease-out',
            }}
          />
        </div>
      )}

      {/* Results table — when running (partial) or complete */}
      {(isRunning || isComplete || hasResults) ? (
        <ResultsTable experiment={experiment} />
      ) : (
        /* Empty / queued state */
        <div
          className="flex flex-col items-center justify-center gap-3 m-6 p-10"
          style={{
            flex: 1,
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          {experiment.status === 'failed' ? (
            <>
              <p className="text-[13px]" style={{ color: 'var(--error-fg)' }}>
                Experiment failed
              </p>
              <p className="text-[12px]" style={{ color: 'var(--fg-muted)' }}>
                Re-run to retry.
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px]" style={{ color: 'var(--fg-secondary)' }}>
                Ready to run
              </p>
              <p className="text-[12px]" style={{ color: 'var(--fg-muted)' }}>
                Press Run to start evaluating.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
