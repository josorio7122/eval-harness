import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FlaskConical, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useExperiments } from '@/hooks/use-experiments'
import type { Experiment } from '@/hooks/use-experiments'
import { CreateExperimentDialog } from './create-experiment-dialog'
import { DataTable } from '@/components/shared/data-table'
import type { Column } from '@/components/shared/data-table'

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
  const total = (exp.revision?.items?.length ?? 0) * (exp.graders?.length ?? 0)
  const done = exp._count?.results ?? exp.results?.length ?? 0
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

const columns: Column<Experiment>[] = [
  {
    header: 'Name',
    width: '1fr',
    render: (exp) => (
      <span className="font-medium text-foreground">{exp.name}</span>
    ),
  },
  {
    header: 'Dataset',
    width: '1fr',
    render: (exp) => (
      <span className="text-muted-foreground pr-4">{exp.dataset?.name ?? '—'}</span>
    ),
  },
  {
    header: 'Graders',
    width: '80px',
    render: (exp) => (
      <span className="font-mono text-muted-foreground">{exp.graders?.length ?? 0}</span>
    ),
  },
  {
    header: 'Status',
    width: '100px',
    headerAlign: 'right',
    cellClassName: 'flex justify-end',
    render: (exp) => <StatusBadge status={exp.status} />,
  },
]

export function ExperimentList() {
  const navigate = useNavigate()
  const { data: experiments, isLoading } = useExperiments()
  const [createOpen, setCreateOpen] = useState(false)

  function handleCreated(id: string) {
    navigate(`/experiments/${id}`)
  }

  return (
    <>
      <DataTable
        title="Experiments"
        columns={columns}
        data={experiments}
        isLoading={isLoading}
        keyExtractor={(exp) => exp.id}
        onRowClick={(exp) => navigate(`/experiments/${exp.id}`)}
        emptyState={{
          icon: FlaskConical,
          title: 'No experiments yet',
          description: 'Run your first eval',
          action: (
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              New experiment
            </Button>
          ),
        }}
        headerAction={
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            New Experiment
          </Button>
        }
        renderRowOverlay={(exp) =>
          exp.status === 'running' ? (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary">
              <div
                className="h-0.5 bg-primary transition-all duration-[400ms] ease-out"
                style={{ width: `${progressPct(exp)}%` }}
              />
            </div>
          ) : null
        }
      />
      <CreateExperimentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </>
  )
}
