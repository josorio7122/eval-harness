import { useParams } from 'react-router'
import { ExperimentList } from '@/components/experiments/experiment-list'
import { ExperimentDetail } from '@/components/experiments/experiment-detail'

export function ExperimentsPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="flex h-full bg-background">
      {/* Left panel: list (30%) */}
      <div className="w-[30%] min-w-[240px] max-w-[320px] flex flex-col h-full overflow-hidden">
        <ExperimentList selectedId={id} />
      </div>

      {/* Right panel: detail (70%) */}
      <div className="flex-1 overflow-hidden flex flex-col border-l border-border">
        {id ? (
          <ExperimentDetail key={id} id={id} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 bg-background">
            <p className="text-[13px] text-muted-foreground">
              Select an experiment to view results
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
