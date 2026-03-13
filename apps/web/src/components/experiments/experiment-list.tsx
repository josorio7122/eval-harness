import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FlaskConical, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useExperiments } from '@/hooks/use-experiments'
import { CreateExperimentDialog } from './create-experiment-dialog'
import type { Experiment } from '@/hooks/use-experiments'
import { EmptyState } from '@/components/shared/empty-state'
import { ListSkeleton } from '@/components/shared/list-skeleton'

const STATUS_LABEL: Record<Experiment['status'], string> = {
  running: 'Running',
  complete: 'Complete',
  failed: 'Failed',
  queued: 'Queued',
}

function StatusBadge({ status }: { status: Experiment['status'] }) {
  if (status === 'running') {
    return <Badge className="bg-primary/10 text-primary border-primary/20">Running</Badge>
  }
  if (status === 'complete') {
    return (
      <Badge className="bg-[var(--pass)]/10 text-[var(--pass-fg)] border-[var(--pass)]/20">
        Complete
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20">Failed</Badge>
    )
  }
  return <Badge variant="outline">{STATUS_LABEL[status]}</Badge>
}

function progressPct(exp: Experiment): number {
  const total = (exp.dataset?.items?.length ?? 0) * (exp.graders?.length ?? 0)
  const done = exp._count?.results ?? exp.results?.length ?? 0
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

export function ExperimentList() {
  const navigate = useNavigate()
  const { data: experiments, isLoading } = useExperiments()
  const [createOpen, setCreateOpen] = useState(false)

  function handleCreated(id: string) {
    navigate(`/experiments/${id}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-[16px] font-semibold text-foreground">Experiments</h2>
        {!isLoading && experiments && experiments.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            New Experiment
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : !experiments || experiments.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No experiments yet"
            description="Run your first eval"
            action={
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus size={14} />
                New experiment
              </Button>
            }
          />
        ) : (
          <div className="m-6 rounded-lg border border-border/50 overflow-hidden">
            <div
              className="grid px-6 py-2.5 border-b border-border/50 bg-muted"
              style={{ gridTemplateColumns: '1fr 1fr 80px 100px' }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dataset
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Graders
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Status
              </span>
            </div>
            {experiments.map((exp) => {
              const pct = progressPct(exp)
              return (
                <button
                  key={exp.id}
                  onClick={() => navigate(`/experiments/${exp.id}`)}
                  className="relative w-full grid items-center px-6 py-3 border-b border-border/50 last:border-b-0 text-left transition-colors bg-transparent hover:bg-card cursor-pointer"
                  style={{ gridTemplateColumns: '1fr 1fr 80px 100px' }}
                >
                  <span className="text-sm font-medium text-foreground truncate">{exp.name}</span>
                  <span className="text-sm text-muted-foreground truncate pr-4">
                    {exp.dataset?.name ?? '—'}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {exp.graders?.length ?? 0}
                  </span>
                  <div className="flex justify-end">
                    <StatusBadge status={exp.status} />
                  </div>

                  {/* Progress bar for running experiments */}
                  {exp.status === 'running' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary">
                      <div
                        className="h-0.5 bg-primary transition-all duration-[400ms] ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <CreateExperimentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
