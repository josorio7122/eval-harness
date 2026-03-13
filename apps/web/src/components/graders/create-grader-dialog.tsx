import { useState, useRef, useEffect } from 'react'
import { useCreateGrader } from '@/hooks/use-graders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CreateGraderDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

export function CreateGraderDialog({ open, onClose, onCreated }: CreateGraderDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rubric, setRubric] = useState('')
  const [prevOpen, setPrevOpen] = useState(open)
  const nameRef = useRef<HTMLInputElement>(null)
  const createGrader = useCreateGrader()

  // Reset form when dialog opens (derived-state pattern)
  if (open && !prevOpen) {
    setPrevOpen(true)
    setName('')
    setDescription('')
    setRubric('')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !rubric.trim()) return
    try {
      const result = await createGrader.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        rubric: rubric.trim(),
      })
      const created = (result as { data?: { id: string } }).data
      onCreated?.(created?.id ?? '')
      onClose()
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[480px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>New Grader</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Relevance grader"
              required
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Description{' '}
              <span className="text-xs font-normal text-muted-foreground/70">(optional)</span>
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this grader evaluate?"
            />
          </div>

          {/* Rubric */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Rubric <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              placeholder="Describe the grading criteria..."
              required
              rows={5}
              className="font-mono text-xs leading-relaxed resize-none"
            />
          </div>

          {/* Error */}
          {createGrader.isError && (
            <p className="text-destructive text-xs">
              {createGrader.error instanceof Error
                ? createGrader.error.message
                : 'Failed to create grader'}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !rubric.trim() || createGrader.isPending}
            >
              {createGrader.isPending ? 'Creating…' : 'Create grader'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
