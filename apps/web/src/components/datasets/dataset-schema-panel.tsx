import { Plus, Trash2 } from 'lucide-react'
import { AddAttributeDialog } from './add-attribute-dialog'
import type { DatasetWithItems, useRemoveAttribute } from '@/hooks/use-datasets'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { SectionLabel } from '@/components/shared/section-label'

interface DatasetSchemaPanelProps {
  dataset: DatasetWithItems
  removeAttr: ReturnType<typeof useRemoveAttribute>
}

export default function DatasetSchemaPanel({ dataset, removeAttr }: DatasetSchemaPanelProps) {
  const [removeAttrError, setRemoveAttrError] = useState('')

  return (
    <div className="flex flex-col border-r border-border overflow-hidden w-[30%] min-w-[200px] max-w-[320px]">
      {/* Schema header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <SectionLabel>Schema</SectionLabel>
        <AddAttributeDialog
          datasetId={dataset.id}
          trigger={
            <Button variant="ghost" size="sm">
              <Plus size={12} />
              Add
            </Button>
          }
        />
      </div>

      {/* Attribute remove error */}
      {removeAttrError && <p className="text-destructive text-xs px-4 py-2">{removeAttrError}</p>}

      {/* Attribute list */}
      <div className="flex-1 overflow-auto">
        {dataset.attributes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground text-sm">
            <p>No attributes defined.</p>
            <AddAttributeDialog
              datasetId={dataset.id}
              trigger={
                <Button variant="ghost" size="sm" className="text-primary underline">
                  Add the first attribute
                </Button>
              }
            />
          </div>
        ) : (
          dataset.attributes.map((attr) => (
            <AttributeRow
              key={attr}
              name={attr}
              protected={attr === 'input' || attr === 'expected_output'}
              onDelete={() => {
                setRemoveAttrError('')
                removeAttr.mutate(
                  { datasetId: dataset.id, name: attr },
                  {
                    onError: (err) =>
                      setRemoveAttrError(
                        err instanceof Error ? err.message : 'Failed to remove attribute.',
                      ),
                  },
                )
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Attribute Row ──────────────────────────────────────────────────────────────

function AttributeRow({
  name,
  onDelete,
  protected: isProtected,
}: {
  name: string
  onDelete: () => void
  protected?: boolean
}) {
  return (
    <div className="group flex items-center justify-between px-4 py-2 border-b border-border hover:bg-accent">
      <span className="text-sm font-mono">{name}</span>
      {isProtected ? (
        <Badge variant="secondary" className="text-[10px]">
          required
        </Badge>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="invisible group-hover:visible text-muted-foreground hover:text-destructive"
        >
          <Trash2 size={12} />
        </Button>
      )}
    </div>
  )
}
