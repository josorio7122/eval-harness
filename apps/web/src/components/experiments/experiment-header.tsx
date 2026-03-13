import { ArrowLeft, Play, RotateCcw, Trash2, Loader2, Download } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Experiment } from '@/hooks/use-experiments'

interface ExperimentHeaderProps {
  experiment: Experiment
  completedCount: number
  totalCount: number
  onRun: () => void
  onRerun: () => void
  onExport: () => void
  onDeleteClick: () => void
  isRunning: boolean
  isRerunning: boolean
  isExporting: boolean
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  complete: 'Complete',
  failed: 'Failed',
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20">Running</Badge>
    )
  }
  if (status === 'complete') {
    return (
      <Badge className="shrink-0 bg-[var(--pass)]/10 text-[var(--pass-fg)] border-[var(--pass)]/20">
        Complete
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge className="shrink-0 bg-destructive/10 text-destructive border-destructive/20">
        Failed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="shrink-0">
      {STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

export function ExperimentHeader({
  experiment,
  completedCount,
  totalCount,
  onRun,
  onRerun,
  onExport,
  onDeleteClick,
  isRunning,
  isRerunning,
  isExporting,
}: ExperimentHeaderProps) {
  const navigate = useNavigate()

  const isRunningOrQueued = experiment.status === 'running' || experiment.status === 'queued'
  const isComplete = experiment.status === 'complete'

  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/experiments')}
        className="text-muted-foreground h-7 w-7 p-0"
      >
        <ArrowLeft size={14} />
      </Button>

      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        /
      </span>

      <h2 className="text-lg font-semibold text-foreground truncate flex-1 min-w-0">
        {experiment.name}
      </h2>

      {/* Dataset name */}
      {experiment.dataset && (
        <span className="text-sm text-muted-foreground shrink-0">{experiment.dataset.name}</span>
      )}

      {/* Revision metadata */}
      {experiment.revision && (
        <>
          <span className="text-sm font-mono text-muted-foreground shrink-0">
            Schema v{experiment.revision.schemaVersion}
          </span>
          <span className="text-sm font-mono text-muted-foreground shrink-0">
            Pinned {new Date(experiment.revision.createdAt).toLocaleDateString()}
          </span>
        </>
      )}

      {/* Status badge */}
      <StatusBadge status={experiment.status} />

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Run button — only when queued */}
        {experiment.status === 'queued' && (
          <Button size="sm" onClick={onRun} disabled={isRunning}>
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run
          </Button>
        )}

        {/* Running: live progress indicator */}
        {isRunningOrQueued && experiment.status === 'running' && (
          <span className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-primary">
            <Loader2 size={12} className="animate-spin" />
            {completedCount}/{totalCount}
          </span>
        )}

        {/* Re-run — only when complete or failed */}
        {(isComplete || experiment.status === 'failed') && (
          <Button variant="outline" size="sm" onClick={onRerun} disabled={isRerunning}>
            {isRerunning ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RotateCcw size={12} />
            )}
            Re-run
          </Button>
        )}

        {/* Export CSV — when complete or failed */}
        {(isComplete || experiment.status === 'failed') && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            Export CSV
          </Button>
        )}

        {/* Delete */}
        <Button
          variant="outline"
          size="sm"
          onClick={onDeleteClick}
          className="text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={12} />
          Delete
        </Button>
      </div>
    </div>
  )
}
