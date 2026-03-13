import { useNavigate } from 'react-router'
import { Database, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateDatasetDialog } from './create-dataset-dialog'
import { useDatasets } from '@/hooks/use-datasets'
import { EmptyState } from '@/components/shared/empty-state'
import { ListSkeleton } from '@/components/shared/list-skeleton'

export function DatasetList() {
  const navigate = useNavigate()
  const { data: datasets, isLoading } = useDatasets()

  function handleCreated(id: string) {
    navigate(`/datasets/${id}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-[16px] font-semibold text-foreground">Datasets</h2>
        <CreateDatasetDialog
          trigger={
            <Button variant="outline" size="sm">
              <Plus size={14} />
              New Dataset
            </Button>
          }
          onCreated={handleCreated}
        />
      </div>

      {/* Table header */}
      {!isLoading && datasets && datasets.length > 0 && (
        <div className="grid px-6 py-2.5 border-b border-border/50 bg-card" style={{ gridTemplateColumns: '1fr auto' }}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Name
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Items / Attrs
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : !datasets || datasets.length === 0 ? (
          // Empty state
          <EmptyState
            icon={Database}
            title="No datasets yet"
            description="Create a dataset to start organizing your eval cases."
            action={
              <CreateDatasetDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus size={14} />
                    Create Dataset
                  </Button>
                }
                onCreated={handleCreated}
              />
            }
          />
        ) : (
          // Dataset rows
          <div>
            {datasets.map((dataset) => (
              <button
                key={dataset.id}
                onClick={() => navigate(`/datasets/${dataset.id}`)}
                className="w-full flex items-center justify-between px-6 py-3 border-b border-border/50 text-left transition-colors bg-transparent hover:bg-card cursor-pointer"
              >
                <span className="text-[13px] font-medium text-foreground">
                  {dataset.name}
                </span>
                <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                  {dataset._count?.items ?? '—'} items · {dataset.attributes.length} attr
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
