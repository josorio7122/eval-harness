import { Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { AddItemDialog } from './add-item-dialog'
import type { DatasetWithItems, DatasetItem, useDeleteItem } from '@/hooks/use-datasets'
import { SectionLabel } from '@/components/shared/section-label'

interface DatasetItemsTableProps {
  dataset: DatasetWithItems
  onEditItem: (item: DatasetItem) => void
  deleteItem: ReturnType<typeof useDeleteItem>
}

export default function DatasetItemsTable({
  dataset,
  onEditItem,
  deleteItem,
}: DatasetItemsTableProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Items header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <SectionLabel>
          Items{' '}
          <Badge variant="secondary" className="ml-2">{dataset.items.length}</Badge>
        </SectionLabel>
        <AddItemDialog
          datasetId={dataset.id}
          attributes={dataset.attributes}
          trigger={
            <Button variant="ghost" size="sm">
              <Plus size={12} />
              Add
            </Button>
          }
        />
      </div>

      {/* Items table */}
      <div className="flex-1 overflow-auto">
        {dataset.attributes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 m-6 text-center bg-muted border border-border rounded-lg min-h-[160px] text-muted-foreground text-xs">
            <p>Add attributes to define the schema before adding items.</p>
          </div>
        ) : dataset.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 m-6 text-center bg-muted border border-border rounded-lg min-h-[160px]">
            <p className="text-foreground text-sm font-medium">No items yet</p>
            <p className="text-muted-foreground text-xs">Add items to populate this dataset.</p>
            <AddItemDialog
              datasetId={dataset.id}
              attributes={dataset.attributes}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus size={14} />
                  Add Item
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                {dataset.attributes.map((attr) => (
                  <TableHead key={attr}>
                    <SectionLabel>{attr}</SectionLabel>
                  </TableHead>
                ))}
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataset.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  attributes={dataset.attributes}
                  onEdit={() => onEditItem(item)}
                  onDelete={() => deleteItem.mutate({ datasetId: dataset.id, itemId: item.itemId })}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

// ── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  attributes,
  onEdit,
  onDelete,
}: {
  item: DatasetItem
  attributes: string[]
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <TableRow className="group hover:bg-accent">
      {attributes.map((attr) => (
        <TableCell
          key={attr}
          className="text-sm font-mono truncate max-w-[200px]"
        >
          {item.values[attr] ?? ''}
        </TableCell>
      ))}
      <TableCell className="text-right w-[60px]">
        <div className="invisible group-hover:visible flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={onEdit} className="text-muted-foreground">
            <Pencil size={12} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 size={12} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
