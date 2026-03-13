import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { GraderList } from '@/components/graders/grader-list'
import { GraderDetail } from '@/components/graders/grader-detail'
import { CreateGraderDialog } from '@/components/graders/create-grader-dialog'

export function GradersPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Left panel: list (30%) */}
      <div className="w-[30%] min-w-[240px] max-w-[320px] flex flex-col h-full overflow-hidden">
        <GraderList selectedId={id} onCreateClick={() => setShowCreate(true)} />
      </div>

      {/* Right panel: detail (70%) */}
      <div className="flex-1 overflow-hidden">
        {id ? (
          <GraderDetail key={id} id={id} />
        ) : (
          <div
            className="flex flex-col items-center justify-center h-full gap-2"
            style={{ background: 'var(--bg-base)' }}
          >
            <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>
              Select a grader to view details
            </p>
          </div>
        )}
      </div>

      <CreateGraderDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(newId) => {
          if (newId) navigate(`/graders/${newId}`)
        }}
      />
    </div>
  )
}
