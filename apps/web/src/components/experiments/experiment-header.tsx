import { RotateCcw, Trash2, Loader2, Download } from 'lucide-react'
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
  onRerun: () => void
  onExport: () => void
  onDeleteClick: () => void
  isRerunning: boolean
  isExporting: boolean
  canExport: boolean
}

export function ExperimentHeader({
  experiment,
  completedCount,
  totalCount,
  onRerun,
  onExport,
  onDeleteClick,
  isRerunning,
  isExporting,
  canExport,
}: ExperimentHeaderProps) {
  const navigate = useNavigate()

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
        {/* Running: live progress indicator */}
        {experiment.status === 'running' && (
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
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!canExport || isExporting}
          >
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
