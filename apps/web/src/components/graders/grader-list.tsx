import { useNavigate } from 'react-router'
import { GraduationCap, Plus } from 'lucide-react'
import { useGraders } from '@/hooks/use-graders'

interface GraderListProps {
  selectedId?: string
  onCreateClick: () => void
}

function ShimmerRow() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-[8px]"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div
        className="h-[13px] w-[140px] rounded animate-pulse"
        style={{ background: 'var(--bg-surface-2)' }}
      />
      <div
        className="h-[13px] w-[200px] rounded animate-pulse"
        style={{ background: 'var(--bg-surface-2)' }}
      />
      <div
        className="ml-auto h-[20px] w-[36px] rounded animate-pulse"
        style={{ background: 'var(--bg-surface-2)' }}
      />
    </div>
  )
}

export function GraderList({ selectedId, onCreateClick }: GraderListProps) {
  const navigate = useNavigate()
  const { data: graders, isLoading } = useGraders()

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-surface-1)', borderRight: '1px solid var(--border-default)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: 'var(--fg-tertiary)', letterSpacing: '0.05em' }}
        >
          Graders
        </span>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1 px-2 h-[28px] rounded text-[12px] font-medium transition-colors"
          style={{
            background: 'var(--bg-surface-2)',
            color: 'var(--fg-secondary)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--fg-primary)'
            e.currentTarget.style.background = 'var(--bg-surface-3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--fg-secondary)'
            e.currentTarget.style.background = 'var(--bg-surface-2)'
          }}
        >
          <Plus size={13} />
          New
        </button>
      </div>

      {/* Table header */}
      <div
        className="grid px-4 py-[6px]"
        style={{
          gridTemplateColumns: '1fr auto',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-2)',
        }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          Name
        </span>
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
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
            className="flex flex-col items-center justify-center gap-3 m-4 p-8 rounded"
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <GraduationCap size={24} style={{ color: 'var(--fg-muted)' }} />
            <div className="text-center">
              <p className="text-[13px]" style={{ color: 'var(--fg-secondary)' }}>
                No graders yet
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--fg-muted)' }}>
                Define a rubric to start evaluating
              </p>
            </div>
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1.5 px-3 h-[32px] text-[13px] font-medium transition-colors"
              style={{
                background: 'var(--bg-surface-2)',
                color: 'var(--fg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
            >
              <Plus size={13} />
              Create grader
            </button>
          </div>
        )}

        {!isLoading &&
          graders &&
          graders.map(grader => {
            const isSelected = grader.id === selectedId
            return (
              <div
                key={grader.id}
                onClick={() => navigate(`/graders/${grader.id}`)}
                className="flex items-center gap-3 px-4 py-[8px] cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                  background: isSelected ? 'var(--bg-surface-2)' : 'transparent',
                  paddingLeft: isSelected ? '14px' : '16px',
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'var(--bg-surface-1)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[13px] font-medium truncate"
                    style={{ color: 'var(--fg-primary)' }}
                  >
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
                  className="shrink-0 text-[11px] font-medium px-[6px] py-[2px]"
                  style={{
                    background: 'var(--accent-subtle)',
                    color: 'var(--accent)',
                    borderRadius: 'var(--radius-sm)',
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
