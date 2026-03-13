import { useNavigate } from 'react-router'
import { GraduationCap, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGraders } from '@/hooks/use-graders'

interface GraderListProps {
  selectedId?: string
  onCreateClick: () => void
}

function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
      <div className="h-[13px] w-[140px] rounded animate-pulse bg-secondary" />
      <div className="h-[13px] w-[200px] rounded animate-pulse bg-secondary" />
      <div className="ml-auto h-[20px] w-[36px] rounded animate-pulse bg-secondary" />
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
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1 px-2 h-[28px] rounded-md text-[12px] font-medium transition-colors bg-secondary text-muted-foreground border border-border hover:bg-accent hover:text-foreground"
        >
          <Plus size={13} />
          New
        </button>
      </div>

      {/* Table header */}
      <div className="grid px-4 py-2.5 border-b border-border/50 bg-secondary" style={{ gridTemplateColumns: '1fr auto' }}>
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
          <div
            className="flex flex-col items-center justify-center gap-3 m-4 p-8 rounded-lg border border-border/50"
            style={{ background: 'var(--bg-inset)' }}
          >
            <GraduationCap size={24} className="text-muted-foreground/60" />
            <div className="text-center">
              <p className="text-[13px] text-muted-foreground">No graders yet</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--fg-muted)' }}>
                Define a rubric to start evaluating
              </p>
            </div>
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1.5 px-3 h-[32px] text-[13px] font-medium transition-colors rounded-md bg-secondary text-foreground border border-border hover:bg-accent"
            >
              <Plus size={13} />
              Create grader
            </button>
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
                    ? 'bg-secondary border-l-[var(--accent-custom)] pl-[14px]'
                    : 'border-l-transparent hover:bg-card/80'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate text-foreground">
                    {grader.name}
                  </div>
                  {grader.description && (
                    <div
                      className="text-[12px] truncate mt-[1px]"
                      style={{ color: 'var(--fg-tertiary)' }}
                    >
                      {grader.description}
                    </div>
                  )}
                </div>
                <span
                  className="shrink-0 text-[11px] font-medium px-[6px] py-[2px] rounded"
                  style={{
                    background: 'var(--accent-subtle)',
                    color: 'var(--accent-custom)',
                    letterSpacing: '0.03em',
                  }}
                >
                  LLM
                </span>
              </div>
            )
          })}
      </div>
    </div>
  )
}
