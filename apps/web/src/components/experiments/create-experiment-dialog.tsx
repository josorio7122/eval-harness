import { useState, useRef, useEffect } from 'react'
import { useCreateExperiment } from '@/hooks/use-experiments'
import { useDatasets } from '@/hooks/use-datasets'
import { useGraders } from '@/hooks/use-graders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CreateExperimentDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

export function CreateExperimentDialog({ open, onClose, onCreated }: CreateExperimentDialogProps) {
  const [name, setName] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [graderIds, setGraderIds] = useState<string[]>([])
  const nameRef = useRef<HTMLInputElement>(null)

  const [prevOpen, setPrevOpen] = useState(open)
  const createExperiment = useCreateExperiment()
  const { data: datasets } = useDatasets()
  const { data: graders } = useGraders()

  // Reset form when dialog opens (derived-state pattern)
  if (open && !prevOpen) {
    setPrevOpen(true)
    setName('')
    setDatasetId('')
    setGraderIds([])
  } else if (!open && prevOpen) {
    setPrevOpen(false)
  }

  // Focus name input after dialog opens (DOM side-effect only, no setState)
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => nameRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  function toggleGrader(id: string) {
    setGraderIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !datasetId || graderIds.length === 0) return
    try {
      const result = await createExperiment.mutateAsync({
        name: name.trim(),
        datasetId,
        graderIds,
      })
      onCreated?.((result as { id?: string }).id ?? '')
      onClose()
    } catch {
      // error handled by mutation state
    }
  }

  const canSubmit = name.trim() && datasetId && graderIds.length > 0

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent showCloseButton className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New Experiment</DialogTitle>
        </DialogHeader>

        <form id="create-experiment" onSubmit={handleSubmit} className="flex flex-col gap-4 min-w-0">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. baseline-v1"
              required
            />
          </div>

          {/* Dataset */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Dataset <span className="text-destructive">*</span>
            </Label>
            <Select value={datasetId} onValueChange={(v) => setDatasetId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a dataset…">
                  {datasetId && datasets?.find(ds => ds.id === datasetId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {datasets
                  ?.filter((ds) => ds.itemCount > 0)
                  .map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Graders */}
          <div className="flex flex-col gap-1.5">
            <Label>
              Graders <span className="text-destructive">*</span>
            </Label>
            <div className="border border-border rounded-md max-h-[160px] overflow-y-auto overflow-x-hidden bg-card">
              {!graders || graders.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">
                  No graders available. Create graders first.
                </p>
              ) : (
                graders.map((grader) => {
                  const selected = graderIds.includes(grader.id)
                  return (
                    <div
                      key={grader.id}
                      className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0 hover:bg-accent"
                    >
                      <Checkbox
                        id={grader.id}
                        checked={selected}
                        onCheckedChange={() => toggleGrader(grader.id)}
                      />
                      <Label htmlFor={grader.id} className="cursor-pointer flex-1 min-w-0 flex-col items-start gap-0.5 text-sm font-normal">
                        <span className="font-medium truncate max-w-full">{grader.name}</span>
                        {grader.description && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-full">
                            {grader.description}
                          </span>
                        )}
                      </Label>
                    </div>
                  )
                })
              )}
            </div>
            {graderIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {graderIds.length} grader{graderIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Error */}
          {createExperiment.isError && (
            <p className="text-destructive text-xs">
              {createExperiment.error instanceof Error
                ? createExperiment.error.message
                : 'Failed to create experiment'}
            </p>
          )}

        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-experiment" disabled={!canSubmit || createExperiment.isPending}>
            {createExperiment.isPending ? 'Creating…' : 'Create experiment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
