import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCreateDataset } from '@/hooks/use-datasets'
import { SectionLabel } from '@/components/shared/section-label'

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
    try {
      const result = (await create.mutateAsync({ name: name.trim() })) as { id?: string }
      setName('')
      setOpen(false)
      if (onCreated && result?.id) {
        onCreated(result.id)
      }
    } catch {
      // error shown via create.error below
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer contents">
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Dataset</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <SectionLabel>Name</SectionLabel>
              <Input
                id="dataset-name"
                placeholder="e.g. customer-qa-pairs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            {create.isError && (
              <p className="text-destructive text-xs">
                {create.error instanceof Error ? create.error.message : 'Failed to create dataset'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={!name.trim() || create.isPending}
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
