import { Badge } from '@/components/ui/badge'

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  complete: 'Complete',
  failed: 'Failed',
}

export function StatusBadge({ status }: { status: string }) {
  if (status === 'running') {
    return <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20">Running</Badge>
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
