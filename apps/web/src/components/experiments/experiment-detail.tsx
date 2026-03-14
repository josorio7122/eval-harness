import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  useExperiment,
  useRunExperiment,
  useRerunExperiment,
  useDeleteExperiment,
  useExperimentSSE,
} from '@/hooks/use-experiments'
import { Skeleton } from '@/components/ui/skeleton'
import { ResultsTable } from './results-table'
import { GraderChart } from './grader-chart'
import { ExperimentHeader } from './experiment-header'
import { ExperimentDeleteDialog } from './experiment-delete-dialog'

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

export function ExperimentDetail({ id }: ExperimentDetailProps) {
  const navigate = useNavigate()
  const { data: experiment, isLoading } = useExperiment(id)
  const runExp = useRunExperiment()
  const rerunExp = useRerunExperiment()
  const deleteExp = useDeleteExperiment()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  // SSE: keep experiment results updated while running
  useExperimentSSE(id, experiment?.status)

  const isRunning = experiment?.status === 'running' || experiment?.status === 'queued'
  const isComplete = experiment?.status === 'complete'
  const hasResults = (experiment?.results?.length ?? 0) > 0
  const canExport =
    (experiment?.status === 'complete' || experiment?.status === 'failed') && hasResults

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex flex-col gap-3 p-6 flex-1">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      </div>
    )
  }

  if (!experiment) {
    return <div className="p-6 text-muted-foreground">Experiment not found.</div>
  }

  async function handleDelete() {
    await deleteExp.mutateAsync(id)
    navigate('/experiments')
  }

  const graderCount = experiment.graders?.length ?? 0
  const totalItems = experiment.revision?.items?.length ?? 0
  const completedItems = (() => {
    const results = experiment.results ?? []
    if (results.length === 0 || graderCount === 0) return 0
    const countsByItem = new Map<string, number>()
    for (const r of results) {
      countsByItem.set(
        r.datasetRevisionItemId,
        (countsByItem.get(r.datasetRevisionItemId) ?? 0) + 1,
      )
    }
    let done = 0
    for (const count of countsByItem.values()) {
      if (count >= graderCount) done++
    }
    return done
  })()
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <ExperimentHeader
        experiment={experiment}
        completedCount={completedItems}
        totalCount={totalItems}
        onRun={() => runExp.mutate(id)}
        onRerun={async () => {
          const result = await rerunExp.mutateAsync(id)
          if (result?.id) {
            navigate(`/experiments/${result.id}`)
          }
        }}
        onExport={async () => {
          if (!canExport) return
          setExportingCsv(true)
          try {
            await downloadExperimentCsv(id, experiment.name)
          } finally {
            setExportingCsv(false)
          }
        }}
        onDeleteClick={() => setShowDeleteDialog(true)}
        isRunning={runExp.isPending}
        isRerunning={rerunExp.isPending}
        isExporting={exportingCsv}
      />

      {/* Delete dialog */}
      <ExperimentDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        experimentName={experiment.name}
        onConfirm={async () => {
          setShowDeleteDialog(false)
          await handleDelete()
        }}
        isDeleting={deleteExp.isPending}
      />

      {/* Running progress bar */}
      {isRunning && (
        <div className="h-1 bg-secondary w-full flex-shrink-0">
          <div
            className="h-1 bg-primary transition-all duration-[400ms] ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Chart — above table when results exist */}
      {(isComplete || hasResults) && (
        <div className="px-6 py-4 border-b border-border flex-shrink-0">
          <GraderChart experiment={experiment} />
        </div>
      )}

      {/* Results table — when running (partial) or complete */}
      {isRunning || isComplete || hasResults ? (
        <ResultsTable experiment={experiment} />
      ) : (
        /* Empty / queued state */
        <div className="flex flex-col flex-1 overflow-hidden px-6 py-6">
          <div className="flex flex-col items-center justify-center gap-3 p-10 h-full bg-muted border border-border rounded-lg">
            {experiment.status === 'failed' ? (
              <>
                <p className="text-[13px] text-destructive">Experiment failed</p>
                <p className="text-xs text-muted-foreground/70">Re-run to retry.</p>
              </>
            ) : (
              <>
                <p className="text-[13px] text-muted-foreground">Ready to run</p>
                <p className="text-xs text-muted-foreground/70">Press Run to start evaluating.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
