import { useRef, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { SectionLabel } from '@/components/shared/section-label'

interface GraderFormProps {
  grader: { id: string; name: string; description: string; rubric: string }
  name: string
  description: string
  rubric: string
  isDirty: boolean
  validationError: string
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onRubricChange: (v: string) => void
  onSave: () => void
  onDeleteClick: () => void
  isSaving: boolean
  saveError: string | null
}

export function GraderForm({
  name,
  description,
  rubric,
  isDirty,
  validationError,
  onNameChange,
  onDescriptionChange,
  onRubricChange,
  onSave,
  onDeleteClick,
  isSaving,
  saveError,
}: GraderFormProps) {
  const rubricRef = useRef<HTMLTextAreaElement>(null)

  const autoGrow = useCallback(() => {
    const el = rubricRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  useEffect(() => {
    autoGrow()
  }, [rubric, autoGrow])

  return (
    <div
      className={cn(
        'flex-1 flex flex-col gap-5 p-6 border-l-2 transition-colors duration-150',
        isDirty ? 'border-l-destructive' : 'border-l-transparent',
      )}
    >
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Name</SectionLabel>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Description</SectionLabel>
        <Input
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="What does this grader evaluate?"
        />
      </div>

      {/* Rubric */}
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="flex items-center justify-between">
          <SectionLabel>Rubric</SectionLabel>
          <Badge variant="secondary">LLM</Badge>
        </div>
        <Textarea
          ref={rubricRef}
          value={rubric}
          onChange={(e) => {
            onRubricChange(e.target.value)
            autoGrow()
          }}
          placeholder="Describe the grading criteria and scoring instructions..."
          className="resize-none overflow-hidden font-mono text-xs leading-relaxed min-h-[200px]"
        />
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="text-destructive text-xs">{validationError}</p>
      )}

      {/* Save error */}
      {saveError && (
        <p className="text-destructive text-xs">{saveError}</p>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onDeleteClick}
          className="hover:border-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 />
          Delete
        </Button>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-destructive text-xs">Unsaved changes</span>
          )}
          <Button size="sm" onClick={onSave} disabled={!isDirty || isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
