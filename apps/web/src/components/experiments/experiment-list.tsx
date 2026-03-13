import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FlaskConical, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useExperiments } from '@/hooks/use-experiments'
import { CreateExperimentDialog } from './create-experiment-dialog'
import type { Experiment } from '@/hooks/use-experiments'

const STATUS_BORDER_COLOR: Record<Experiment['status'], string> = {
  running: 'var(--accent-custom)',
  complete: 'var(--pass)',
  failed: 'var(--error)',
  queued: 'var(--neutral)',
}

const STATUS_BADGE_VARIANT: Record<Experiment['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  complete: 'secondary',
  failed: 'destructive',
  queued: 'outline',
}

const STATUS_LABEL: Record<Experiment['status'], string> = {
  running: 'Running',
  complete: 'Complete',
  failed: 'Failed',
  queued: 'Queued',
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
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={13} />
          New
        </Button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <div className="flex-1 flex flex-col gap-[6px]">
                <Skeleton className="h-[13px] w-[140px]" />
                <Skeleton className="h-[11px] w-[90px]" />
              </div>
              <Skeleton className="h-[20px] w-[56px]" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <div className="flex-1 flex flex-col gap-[6px]">
                <Skeleton className="h-[13px] w-[140px]" />
                <Skeleton className="h-[11px] w-[90px]" />
              </div>
              <Skeleton className="h-[20px] w-[56px]" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <div className="flex-1 flex flex-col gap-[6px]">
                <Skeleton className="h-[13px] w-[140px]" />
                <Skeleton className="h-[11px] w-[90px]" />
              </div>
              <Skeleton className="h-[20px] w-[56px]" />
            </div>
          </>
        )}

        {!isLoading && experiments && experiments.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 m-4 p-8 rounded-lg border border-border/50 bg-muted">
            <FlaskConical size={24} className="text-muted-foreground/60" />
            <div className="text-center">
              <p className="text-[13px] text-muted-foreground">No experiments yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Run your first eval</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={13} />
              New experiment
            </Button>
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
                  isSelected ? 'bg-secondary pl-[14px]' : 'border-l-transparent hover:bg-accent',
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
                        <span className="text-[11px] truncate text-muted-foreground">
                          {exp.dataset.name}
                        </span>
                      )}
                      {exp.revision && (
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                          v{exp.revision.schemaVersion}
                        </span>
                      )}
                      {exp.graders && exp.graders.length > 0 && (
                        <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70 shrink-0">
                          {exp.graders.length}g
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <Badge variant={STATUS_BADGE_VARIANT[exp.status]} className="shrink-0">
                    {STATUS_LABEL[exp.status]}
                  </Badge>
                </div>

                {/* Running: progress bar at bottom */}
                {exp.status === 'running' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary">
                    <div
                      className="h-0.5 bg-primary transition-all duration-[400ms] ease-out"
                      style={{ width: `${pct}%` }}
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
