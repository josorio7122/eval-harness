import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
      <span onClick={openDialog} style={{ cursor: 'pointer', display: 'contents' }}>
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
  const updateItem = useUpdateItem()

  // Sync values when item changes
  useEffect(() => {
    setValues(item.values)
  }, [item.id])

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
    <DialogContent
      className="sm:max-w-md"
      style={{
        background: 'var(--bg-surface-1)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <DialogHeader>
        <DialogTitle
          style={{ color: 'var(--fg-primary)', fontSize: '14px', fontWeight: 600 }}
        >
          {title}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-2">
        {attributes.length === 0 ? (
          <p style={{ color: 'var(--fg-secondary)', fontSize: '13px' }}>
            No attributes defined. Add attributes first.
          </p>
        ) : (
          attributes.map((attr) => (
            <div key={attr} className="flex flex-col gap-1.5">
              <label
                htmlFor={`item-${attr}`}
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--fg-tertiary)',
                }}
              >
                {attr}
              </label>
              <Input
                id={`item-${attr}`}
                value={values[attr] ?? ''}
                onChange={(e) =>
                  onChange({ ...values, [attr]: e.target.value })
                }
                style={{
                  background: 'var(--bg-surface-2)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--fg-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>
          ))
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            style={{ color: 'var(--fg-secondary)' }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={attributes.length === 0 || isPending}
            style={{
              background: 'var(--bg-surface-2)',
              color: 'var(--fg-primary)',
              borderColor: 'var(--border-strong)',
            }}
          >
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
