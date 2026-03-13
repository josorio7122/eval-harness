import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FlaskConical, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useExperiments } from '@/hooks/use-experiments'
import { CreateExperimentDialog } from './create-experiment-dialog'
import type { Experiment } from '@/hooks/use-experiments'

const STATUS_BORDER_COLOR: Record<Experiment['status'], string> = {
  running: 'var(--accent-custom)',
  complete: 'var(--pass)', // overridden below if any fail
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
  running: 'var(--accent-custom)',
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
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
      <div className="flex-1 flex flex-col gap-[6px]">
        <div className="h-[13px] w-[140px] rounded animate-pulse bg-secondary" />
        <div className="h-[11px] w-[90px] rounded animate-pulse bg-secondary" />
      </div>
      <div className="h-[20px] w-[56px] rounded animate-pulse bg-secondary" />
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
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Experiments
        </span>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 px-2 h-[28px] rounded-md text-[12px] font-medium transition-colors bg-secondary text-muted-foreground border border-border hover:bg-accent hover:text-foreground"
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
            className="flex flex-col items-center justify-center gap-3 m-4 p-8 rounded-lg border border-border/50"
            style={{ background: 'var(--bg-inset)' }}
          >
            <FlaskConical size={24} className="text-muted-foreground/60" />
            <div className="text-center">
              <p className="text-[13px] text-muted-foreground">No experiments yet</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--fg-muted)' }}>
                Run your first eval
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 h-[32px] text-[13px] font-medium transition-colors rounded-md bg-secondary text-foreground border border-border hover:bg-accent"
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
              exp.status === 'complete' && fails ? 'var(--fail)' : STATUS_BORDER_COLOR[exp.status]
            const pct = progressPct(exp)

            return (
              <div
                key={exp.id}
                onClick={() => navigate(`/experiments/${exp.id}`)}
                className={cn(
                  'relative cursor-pointer transition-colors px-4 border-b border-border/50 border-l-2',
                  exp.status === 'running' ? 'pt-2.5 pb-3' : 'py-2.5',
                  isSelected
                    ? 'bg-secondary pl-[14px]'
                    : 'border-l-transparent hover:bg-card/80'
                )}
                style={{
                  borderLeftColor: isSelected ? borderColor : 'transparent',
                }}
              >
                {/* Row content */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate text-foreground">
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
                      {exp.revision && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--fg-tertiary)',
                            flexShrink: 0,
                          }}
                        >
                          v{exp.revision.schemaVersion}
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

                  {/* Status badge — dynamic color must stay inline */}
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
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'var(--accent-custom)',
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
