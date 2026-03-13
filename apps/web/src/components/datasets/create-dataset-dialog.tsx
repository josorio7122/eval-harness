import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCreateDataset } from '@/hooks/use-datasets'

interface CreateDatasetDialogProps {
  trigger: React.ReactNode
  onCreated?: (id: string) => void
}

export function CreateDatasetDialog({ trigger, onCreated }: CreateDatasetDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useCreateDataset()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const result = (await create.mutateAsync({ name: name.trim() })) as {
      data?: { id: string }
    }
    setName('')
    setOpen(false)
    if (onCreated && result?.data?.id) {
      onCreated(result.data.id)
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ cursor: 'pointer', display: 'contents' }}>
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-sm"
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
              Create Dataset
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="dataset-name"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--fg-tertiary)',
                }}
              >
                Name
              </label>
              <Input
                id="dataset-name"
                placeholder="e.g. customer-qa-pairs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                style={{
                  background: 'var(--bg-surface-2)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--fg-primary)',
                  fontSize: '13px',
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                style={{ color: 'var(--fg-secondary)' }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!name.trim() || create.isPending}
                style={{
                  background: 'var(--bg-surface-2)',
                  color: 'var(--fg-primary)',
                  borderColor: 'var(--border-strong)',
                }}
              >
                {create.isPending ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
