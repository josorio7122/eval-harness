import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FlaskConical, Plus } from 'lucide-react'
import { useExperiments } from '@/hooks/use-experiments'
import { CreateExperimentDialog } from './create-experiment-dialog'
import type { Experiment } from '@/hooks/use-experiments'

const STATUS_BORDER_COLOR: Record<Experiment['status'], string> = {
  running: 'var(--accent)',
  complete: 'var(--pass)',   // overridden below if any fail
  failed: 'var(--error)',
  queued: 'var(--neutral)',
}

const STATUS_LABEL: Record<Experiment['status'], string> = {
  running: 'Running',
  complete: 'Complete',
  failed: 'Failed',
  queued: 'Queued',
}

const STATUS_COLOR: Record<Experiment['status'], string> = {
  running: 'var(--accent)',
  complete: 'var(--pass-fg)',
  failed: 'var(--error-fg)',
  queued: 'var(--neutral-fg)',
}

function hasFails(exp: Experiment): boolean {
  return (exp.results ?? []).some((r) => r.verdict === 'fail' || r.verdict === 'error')
}

function progressPct(exp: Experiment): number {
  const total = (exp.dataset?.items?.length ?? 0) * (exp.graders?.length ?? 0)
  const done = exp._count?.results ?? exp.results?.length ?? 0
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

function ShimmerRow() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          className="h-[13px] w-[140px] rounded animate-pulse"
          style={{ background: 'var(--bg-surface-2)' }}
        />
        <div
          className="h-[11px] w-[90px] rounded animate-pulse"
          style={{ background: 'var(--bg-surface-2)' }}
        />
      </div>
      <div
        className="h-[20px] w-[56px] rounded animate-pulse"
        style={{ background: 'var(--bg-surface-2)' }}
      />
    </div>
  )
}

interface ExperimentListProps {
  selectedId?: string
}

export function ExperimentList({ selectedId }: ExperimentListProps) {
  const navigate = useNavigate()
  const { data: experiments, isLoading } = useExperiments()
  const [createOpen, setCreateOpen] = useState(false)

  function handleCreated(id: string) {
    navigate(`/experiments/${id}`)
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-surface-1)', borderRight: '1px solid var(--border-default)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          Experiments
        </span>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 px-2 h-[28px] rounded text-[12px] font-medium transition-colors"
          style={{
            background: 'var(--bg-surface-2)',
            color: 'var(--fg-secondary)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--fg-primary)'
            e.currentTarget.style.background = 'var(--bg-surface-3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--fg-secondary)'
            e.currentTarget.style.background = 'var(--bg-surface-2)'
          }}
        >
          <Plus size={13} />
          New
        </button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <>
            <ShimmerRow />
            <ShimmerRow />
            <ShimmerRow />
          </>
        )}

        {!isLoading && experiments && experiments.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-3 m-4 p-8 rounded"
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <FlaskConical size={24} style={{ color: 'var(--fg-muted)' }} />
            <div className="text-center">
              <p className="text-[13px]" style={{ color: 'var(--fg-secondary)' }}>
                No experiments yet
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--fg-muted)' }}>
                Run your first eval
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 h-[32px] text-[13px] font-medium transition-colors"
              style={{
                background: 'var(--bg-surface-2)',
                color: 'var(--fg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
            >
              <Plus size={13} />
              New experiment
            </button>
          </div>
        )}

        {!isLoading &&
          experiments &&
          experiments.map((exp) => {
            const isSelected = exp.id === selectedId
            const fails = hasFails(exp)
            const borderColor =
              exp.status === 'complete' && fails
                ? 'var(--fail)'
                : STATUS_BORDER_COLOR[exp.status]
            const pct = progressPct(exp)

            return (
              <div
                key={exp.id}
                onClick={() => navigate(`/experiments/${exp.id}`)}
                className="relative cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  borderLeft: isSelected ? `2px solid ${borderColor}` : '2px solid transparent',
                  background: isSelected ? 'var(--bg-surface-2)' : 'transparent',
                  paddingLeft: isSelected ? '14px' : '16px',
                  paddingRight: '16px',
                  paddingTop: '10px',
                  paddingBottom: exp.status === 'running' ? '12px' : '10px',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-1)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Row content */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] font-medium truncate"
                      style={{ color: 'var(--fg-primary)' }}
                    >
                      {exp.name}
                    </div>
                    <div className="flex items-center gap-2 mt-[2px]">
                      {exp.dataset && (
                        <span
                          className="text-[11px] truncate"
                          style={{ color: 'var(--fg-tertiary)' }}
                        >
                          {exp.dataset.name}
                        </span>
                      )}
                      {exp.graders && exp.graders.length > 0 && (
                        <span
                          className="text-[11px]"
                          style={{
                            color: 'var(--fg-muted)',
                            fontFamily: 'var(--font-mono)',
                            fontVariantNumeric: 'tabular-nums',
                            flexShrink: 0,
                          }}
                        >
                          {exp.graders.length}g
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    className="shrink-0 text-[11px] font-medium"
                    style={{ color: STATUS_COLOR[exp.status] }}
                  >
                    {STATUS_LABEL[exp.status]}
                  </span>
                </div>

                {/* Running: progress bar at bottom */}
                {exp.status === 'running' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'var(--bg-surface-3)',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'var(--accent)',
                        transition: 'width 400ms ease-out',
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <CreateExperimentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
