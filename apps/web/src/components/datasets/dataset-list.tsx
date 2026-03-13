import { useNavigate } from 'react-router'
import { Database, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateDatasetDialog } from './create-dataset-dialog'
import { useDatasets } from '@/hooks/use-datasets'

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
          // Shimmer loading rows
          <div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between px-6 py-3 border-b border-border/50"
              >
                <Skeleton className={`h-3 ${i === 1 ? 'w-28' : i === 2 ? 'w-36' : 'w-44'}`} />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        ) : !datasets || datasets.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center gap-4 m-6 p-10 rounded-lg border border-border/50 bg-muted min-h-[220px]">
            <Database size={32} className="text-muted-foreground/60" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-[14px] font-medium text-muted-foreground">No datasets yet</p>
              <p className="text-[12px] text-muted-foreground/70">
                Create a dataset to start organizing your eval cases.
              </p>
            </div>
            <CreateDatasetDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Plus size={14} />
                  Create Dataset
                </Button>
              }
              onCreated={handleCreated}
            />
          </div>
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
