import { useNavigate } from 'react-router'
import { Database, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateDatasetDialog } from './create-dataset-dialog'
import { useDatasets } from '@/hooks/use-datasets'
import type { Dataset } from '@/hooks/use-datasets'
import { DataTable } from '@/components/shared/data-table'
import type { Column } from '@/components/shared/data-table'

const columns: Column<Dataset>[] = [
  {
    header: 'Name',
    width: '1fr',
    render: (d) => (
      <span className="font-medium text-foreground">{d.name}</span>
    ),
  },
  {
    header: 'Items / Attrs',
    width: 'auto',
    headerAlign: 'right',
    cellClassName: 'text-right',
    render: (d) => (
      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
        {d._count?.items ?? '—'} items · {d.attributes.length} attr
      </span>
    ),
  },
]

export function DatasetList() {
  const navigate = useNavigate()
  const { data: datasets, isLoading } = useDatasets()

  function handleCreated(id: string) {
    navigate(`/datasets/${id}`)
  }

  return (
    <DataTable
      title="Datasets"
      columns={columns}
      data={datasets}
      isLoading={isLoading}
      keyExtractor={(d) => d.id}
      onRowClick={(d) => navigate(`/datasets/${d.id}`)}
      emptyState={{
        icon: Database,
        title: 'No datasets yet',
        description: 'Create a dataset to start organizing your eval cases.',
        action: (
          <CreateDatasetDialog
            trigger={
              <Button variant="outline" size="sm">
                <Plus size={14} />
                Create Dataset
              </Button>
            }
            onCreated={handleCreated}
          />
        ),
      }}
      headerAction={
        <CreateDatasetDialog
          trigger={
            <Button variant="outline" size="sm">
              <Plus size={14} />
              New Dataset
            </Button>
          }
          onCreated={handleCreated}
        />
      }
    />
  )
}
