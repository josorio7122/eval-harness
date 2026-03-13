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
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} />
          New Experiment
        </Button>
      </div>

      {/* Table header */}
      {!isLoading && experiments && experiments.length > 0 && (
        <div
          className="grid px-6 py-2.5 border-b border-border/50 bg-card"
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
      )}

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
          <div>
            {experiments.map((exp) => {
              const pct = progressPct(exp)
              return (
                <button
                  key={exp.id}
                  onClick={() => navigate(`/experiments/${exp.id}`)}
                  className="relative w-full grid items-center px-6 py-3 border-b border-border/50 text-left transition-colors bg-transparent hover:bg-card cursor-pointer"
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
                    <Badge variant={STATUS_BADGE_VARIANT[exp.status]}>
                      {STATUS_LABEL[exp.status]}
                    </Badge>
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
