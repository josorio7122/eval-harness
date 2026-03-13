import { useParams } from 'react-router'
import { ExperimentList } from '@/components/experiments/experiment-list'
import { ExperimentDetail } from '@/components/experiments/experiment-detail'

export function ExperimentsPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="flex h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Left panel: list (30%) */}
      <div className="w-[30%] min-w-[240px] max-w-[320px] flex flex-col h-full overflow-hidden">
        <ExperimentList selectedId={id} />
      </div>

      {/* Right panel: detail (70%) */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ borderLeft: '1px solid var(--border-default)' }}>
        {id ? (
          <ExperimentDetail key={id} id={id} />
        ) : (
          <div
            className="flex flex-col items-center justify-center h-full gap-2"
            style={{ background: 'var(--bg-base)' }}
          >
            <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>
              Select an experiment to view results
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
