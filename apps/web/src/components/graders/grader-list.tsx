import { useState } from 'react'
import { useNavigate } from 'react-router'
import { GraduationCap, Plus } from 'lucide-react'
import { useGraders } from '@/hooks/use-graders'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { ListSkeleton } from '@/components/shared/list-skeleton'
import { CreateGraderDialog } from './create-grader-dialog'

export function GraderList() {
  const navigate = useNavigate()
  const { data: graders, isLoading } = useGraders()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-[16px] font-semibold text-foreground">Graders</h2>
        {!isLoading && graders && graders.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New Grader
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : !graders || graders.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No graders yet"
            description="Define a rubric to start evaluating"
            action={
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} />
                Create grader
              </Button>
            }
          />
        ) : (
          <div className="m-6 rounded-lg border border-border/50 overflow-hidden">
            <div
              className="grid px-6 py-2.5 border-b border-border/50 bg-muted"
              style={{ gridTemplateColumns: '1fr 1fr' }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </span>
            </div>
            {graders.map((grader) => (
              <button
                key={grader.id}
                onClick={() => navigate(`/graders/${grader.id}`)}
                className="w-full grid items-center px-6 py-3 border-b border-border/50 last:border-b-0 text-left transition-colors bg-transparent hover:bg-card cursor-pointer"
                style={{ gridTemplateColumns: '1fr 1fr' }}
              >
                <span className="text-sm font-medium text-foreground truncate">{grader.name}</span>
                <span className="text-sm text-muted-foreground truncate pr-4">
                  {grader.description || '—'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <CreateGraderDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          if (id) navigate(`/graders/${id}`)
        }}
      />
    </div>
  )
}
