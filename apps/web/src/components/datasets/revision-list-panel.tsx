import { useRevisions } from '@/hooks/use-datasets'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { SectionLabel } from '@/components/shared/section-label'

interface RevisionListPanelProps {
  datasetId: string
  selectedRevisionId: string | undefined
  onSelect: (id: string) => void
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function ShimmerRow() {
  return (
    <div className="px-4 py-2.5 border-b border-border flex flex-col gap-1.5">
      <Skeleton className="h-3 w-14" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

export function RevisionListPanel({ datasetId, selectedRevisionId, onSelect }: RevisionListPanelProps) {
  const { data: revisions, isLoading } = useRevisions(datasetId)

  return (
    <div className="w-[40%] min-w-[200px] border-r border-border flex flex-col overflow-hidden">
      {/* List header */}
      <div className="px-4 py-2.5 border-b border-border">
        <SectionLabel>History</SectionLabel>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <>
            <ShimmerRow />
            <ShimmerRow />
            <ShimmerRow />
          </>
        )}

        {!isLoading && (!revisions || revisions.length === 0) && (
          <div className="px-4 py-8 text-center text-muted-foreground/70 text-xs">
            No revision history
          </div>
        )}

        {!isLoading &&
          revisions &&
          revisions.map((rev, idx) => {
            const isSelected = rev.id === selectedRevisionId
            const prevRev = revisions[idx + 1]
            const schemaChanged = !prevRev || prevRev.schemaVersion !== rev.schemaVersion

            return (
              <button
                key={rev.id}
                onClick={() => onSelect(rev.id)}
                className={cn(
                  'w-full text-left px-4 py-2.5 border-b border-border flex flex-col gap-1 transition-colors hover:bg-accent',
                  isSelected && 'bg-accent border-l-2 border-l-primary',
                )}
              >
                {/* Top row: version + current badge */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'text-sm font-mono text-foreground',
                      schemaChanged && 'font-bold',
                    )}
                  >
                    v{rev.schemaVersion}
                  </span>
                  {rev.isCurrent && (
                    <Badge variant="secondary" className="text-[10px]">
                      Current
                    </Badge>
                  )}
                </div>

                {/* Second row: item count + experiment count + time */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{rev.itemCount} items</span>
                  <span className="text-xs text-muted-foreground/70">
                    {rev.experimentCount} experiment{rev.experimentCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 ml-auto font-mono">
                    {relativeTime(rev.createdAt)}
                  </span>
                </div>

                {/* Third row: attributes */}
                {rev.attributes.length > 0 && (
                  <div className="text-xs font-mono text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                    {rev.attributes.join(' · ')}
                  </div>
                )}
              </button>
            )
          })}
      </div>
    </div>
  )
}
