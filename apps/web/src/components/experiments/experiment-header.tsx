import { Play, RotateCcw, Trash2, Loader2, Download } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Experiment } from '@/hooks/use-experiments'
import { PageHeader } from '@/components/shared/page-header'
import { getModelDisplayName } from '@/lib/models'
import { StatusBadge } from './status-badge'

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
    <PageHeader onBack={() => navigate('/experiments')} className="flex-shrink-0">
      <h2 className="text-lg font-semibold text-foreground truncate flex-1 min-w-0">
        {experiment.name}
      </h2>

      {/* Metadata badges */}
      {experiment.dataset && (
        <Badge variant="secondary" className="shrink-0 font-normal">
          {experiment.dataset.name}
        </Badge>
      )}
      {experiment.modelId && (
        <Badge variant="outline" className="shrink-0 font-normal">
          {getModelDisplayName(experiment.modelId)}
        </Badge>
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
            {isRerunning ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Re-run
          </Button>
        )}

        {/* Export CSV — when complete or failed */}
        {(isComplete || experiment.status === 'failed') && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={isExporting}>
            {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
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
    </PageHeader>
  )
}
