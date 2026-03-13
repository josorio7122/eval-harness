import { useNavigate } from 'react-router'
import { GraduationCap, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGraders } from '@/hooks/use-graders'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface GraderListProps {
  selectedId?: string
  onCreateClick: () => void
}

function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
      <Skeleton className="h-3 w-36" />
      <Skeleton className="h-3 w-48" />
      <Skeleton className="ml-auto h-5 w-9" />
    </div>
  )
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
        {isLoading && (
          <>
            <ShimmerRow />
            <ShimmerRow />
            <ShimmerRow />
          </>
        )}

        {!isLoading && graders && graders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 m-4 p-8 rounded-lg border border-border/50 bg-muted/30">
            <GraduationCap size={24} className="text-muted-foreground/60" />
            <div className="text-center">
              <p className="text-[13px] text-muted-foreground">No graders yet</p>
              <p className="text-[12px] mt-1 text-muted-foreground/70">
                Define a rubric to start evaluating
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onCreateClick}>
              <Plus />
              Create grader
            </Button>
          </div>
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
