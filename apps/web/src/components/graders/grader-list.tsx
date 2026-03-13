import { useNavigate } from 'react-router'
import { GraduationCap, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGraders } from '@/hooks/use-graders'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { ListSkeleton } from '@/components/shared/list-skeleton'

interface GraderListProps {
  selectedId?: string
  onCreateClick: () => void
}

export function GraderList({ selectedId, onCreateClick }: GraderListProps) {
  const navigate = useNavigate()
  const { data: graders, isLoading } = useGraders()

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Graders
        </span>
        <Button variant="outline" size="sm" onClick={onCreateClick}>
          <Plus />
          New
        </Button>
      </div>

      {/* Table header */}
      <div
        className="grid px-4 py-2.5 border-b border-border/50 bg-muted"
        style={{ gridTemplateColumns: '1fr auto' }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Name
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Type
        </span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {isLoading && <ListSkeleton rows={3} />}

        {!isLoading && graders && graders.length === 0 && (
          <EmptyState
            icon={GraduationCap}
            title="No graders yet"
            description="Define a rubric to start evaluating"
            action={
              <Button variant="outline" size="sm" onClick={onCreateClick}>
                <Plus />
                Create grader
              </Button>
            }
          />
        )}

        {!isLoading &&
          graders &&
          graders.map((grader) => {
            const isSelected = grader.id === selectedId
            return (
              <div
                key={grader.id}
                onClick={() => navigate(`/graders/${grader.id}`)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/50 border-l-2',
                  isSelected
                    ? 'bg-accent border-l-primary pl-[14px]'
                    : 'border-l-transparent hover:bg-accent',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate text-foreground">
                    {grader.name}
                  </div>
                  {grader.description && (
                    <div className="text-[12px] truncate mt-[1px] text-muted-foreground">
                      {grader.description}
                    </div>
                  )}
                </div>
                <Badge variant="secondary">LLM</Badge>
              </div>
            )
          })}
      </div>
    </div>
  )
}
