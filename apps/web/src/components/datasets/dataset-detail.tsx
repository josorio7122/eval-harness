import { useState } from 'react'
import { useNavigate } from 'react-router'
import { RevisionHistory } from './revision-history'
import { EditItemDialog } from './add-item-dialog'
import DatasetHeader from './dataset-header'
import DatasetSchemaPanel from './dataset-schema-panel'
import DatasetItemsTable from './dataset-items-table'
import DatasetCsvDialog from './dataset-csv-dialog'
import { DatasetDeleteDialog } from './dataset-delete-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  useDataset,
  useUpdateDataset,
  useRemoveAttribute,
  useDeleteItem,
  useDeleteDataset,
  useDownloadCsvTemplate,
  useExportCsv,
} from '@/hooks/use-datasets'
import type { DatasetItem } from '@/hooks/use-datasets'
import { useExperiments } from '@/hooks/use-experiments'

interface DatasetDetailProps {
  id: string
}

export function DatasetDetail({ id }: DatasetDetailProps) {
  const navigate = useNavigate()
  const { data: dataset, isLoading } = useDataset(id)
  const updateDataset = useUpdateDataset()
  const removeAttr = useRemoveAttribute()
  const deleteItem = useDeleteItem()
  const deleteDataset = useDeleteDataset()
  const downloadTemplate = useDownloadCsvTemplate()
  const exportCsv = useExportCsv()
  const { data: allExperiments } = useExperiments()
  const [activeTab, setActiveTab] = useState<'items' | 'history'>('items')
  const [editItem, setEditItem] = useState<DatasetItem | undefined>(undefined)
  const [editOpen, setEditOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const affectedExperiments = (allExperiments ?? []).filter((exp) => exp.datasetId === id)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-1">
          <div className="w-[30%] border-r border-border p-4 flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
          <div className="flex-1 p-4" />
        </div>
      </div>
    )
  }

  if (!dataset) {
    return (
      <div className="p-6 text-muted-foreground">
        Dataset not found.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <DatasetHeader
        dataset={dataset}
        onImportClick={() => setImportDialogOpen(true)}
        onDeleteClick={() => setDeleteDialogOpen(true)}
        downloadTemplate={downloadTemplate}
        exportCsv={exportCsv}
        deleteDataset={deleteDataset}
        updateDataset={updateDataset}
        navigate={navigate}
      />

      {/* Delete Dataset Confirmation Dialog */}
      <DatasetDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        datasetName={dataset.name}
        affectedExperiments={affectedExperiments.map((exp) => exp.name)}
        onConfirm={async () => {
          await deleteDataset.mutateAsync(id)
          setDeleteDialogOpen(false)
          navigate('/datasets')
        }}
        isDeleting={deleteDataset.isPending}
      />

      {/* CSV Import Dialog */}
      <DatasetCsvDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        datasetId={id}
        onImportSuccess={() => {}}
      />

      {/* Tab strip */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'items' | 'history')}
        className="flex flex-col flex-1 overflow-hidden gap-0"
      >
        <div className="border-b border-border px-6">
          <TabsList variant="line" className="h-10">
            <TabsTrigger
              value="items"
              className="text-[11px] font-semibold uppercase tracking-wider"
            >
              Items
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-[11px] font-semibold uppercase tracking-wider"
            >
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="history" className="flex-1 overflow-hidden">
          <RevisionHistory datasetId={id} />
        </TabsContent>

        <TabsContent value="items" className="flex flex-1 overflow-hidden">
          <DatasetSchemaPanel dataset={dataset} removeAttr={removeAttr} />
          <DatasetItemsTable
            dataset={dataset}
            onEditItem={(item) => {
              setEditItem(item)
              setEditOpen(true)
            }}
            deleteItem={deleteItem}
          />
        </TabsContent>
      </Tabs>

      {/* Edit item dialog — controlled externally */}
      {editItem && (
        <EditItemDialog
          datasetId={id}
          item={editItem}
          attributes={dataset.attributes}
          open={editOpen}
          onOpenChange={(v) => {
            setEditOpen(v)
            if (!v) setEditItem(undefined)
          }}
        />
      )}
    </div>
  )
}
