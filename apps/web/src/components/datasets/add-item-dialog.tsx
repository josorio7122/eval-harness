import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCreateItem, useUpdateItem } from '@/hooks/use-datasets'
import type { DatasetItem } from '@/hooks/use-datasets'

// ── Add Item Dialog (trigger-controlled) ──────────────────────────────────────

interface AddItemDialogProps {
  datasetId: string
  attributes: string[]
  trigger: React.ReactNode
}

export function AddItemDialog({ datasetId, attributes, trigger }: AddItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const createItem = useCreateItem()

  function openDialog() {
    setValues(Object.fromEntries(attributes.map((a) => [a, ''])))
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createItem.mutateAsync({ datasetId, values })
    setOpen(false)
  }

  return (
    <>
      <span onClick={openDialog} className="cursor-pointer contents">
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <ItemDialogContent
          title="Add Item"
          attributes={attributes}
          values={values}
          onChange={setValues}
          onSubmit={handleSubmit}
          onClose={() => setOpen(false)}
          isPending={createItem.isPending}
          submitLabel="Add"
          pendingLabel="Adding…"
        />
      </Dialog>
    </>
  )
}

// ── Edit Item Dialog (externally controlled open state) ───────────────────────

interface EditItemDialogProps {
  datasetId: string
  item: DatasetItem
  attributes: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditItemDialog({
  datasetId,
  item,
  attributes,
  open,
  onOpenChange,
}: EditItemDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(item.values)
  const [syncedItemId, setSyncedItemId] = useState(item.id)
  const updateItem = useUpdateItem()

  // Sync values when item changes (derived-state pattern)
  if (syncedItemId !== item.id) {
    setSyncedItemId(item.id)
    setValues(item.values)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await updateItem.mutateAsync({ datasetId, itemId: item.id, values })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ItemDialogContent
        title="Edit Item"
        attributes={attributes}
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        onClose={() => onOpenChange(false)}
        isPending={updateItem.isPending}
        submitLabel="Save"
        pendingLabel="Saving…"
      />
    </Dialog>
  )
}

// ── Shared dialog body ─────────────────────────────────────────────────────────

interface ItemDialogContentProps {
  title: string
  attributes: string[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  isPending: boolean
  submitLabel: string
  pendingLabel: string
}

function ItemDialogContent({
  title,
  attributes,
  values,
  onChange,
  onSubmit,
  onClose,
  isPending,
  submitLabel,
  pendingLabel,
}: ItemDialogContentProps) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-2">
        {attributes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attributes defined. Add attributes first.
          </p>
        ) : (
          attributes.map((attr) => (
            <div key={attr} className="flex flex-col gap-1.5">
              <label
                htmlFor={`item-${attr}`}
                className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
              >
                {attr}
              </label>
              <Input
                id={`item-${attr}`}
                value={values[attr] ?? ''}
                onChange={(e) => onChange({ ...values, [attr]: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
          ))
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={attributes.length === 0 || isPending}
          >
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
