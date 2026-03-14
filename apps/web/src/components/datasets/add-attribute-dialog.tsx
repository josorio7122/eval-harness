import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAddAttribute } from '@/hooks/use-datasets'
import { SectionLabel } from '@/components/shared/section-label'

interface AddAttributeDialogProps {
  datasetId: string
  trigger: React.ReactNode
}

export function AddAttributeDialog({ datasetId, trigger }: AddAttributeDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const addAttr = useAddAttribute()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await addAttr.mutateAsync({ datasetId, name: name.trim() })
      setName('')
      setOpen(false)
    } catch {
      // error shown via addAttr.error below
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
            <DialogTitle>Add Attribute</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <SectionLabel>Attribute Name</SectionLabel>
              <Input
                id="attr-name"
                placeholder="e.g. expected_output"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            {addAttr.isError && (
              <p className="text-destructive text-xs">
                {addAttr.error instanceof Error ? addAttr.error.message : 'Failed to add attribute'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={!name.trim() || addAttr.isPending}
              >
                {addAttr.isPending ? 'Adding…' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
