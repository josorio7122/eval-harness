import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGrader, useUpdateGrader, useDeleteGrader } from '@/hooks/use-graders'
import { useExperiments } from '@/hooks/use-experiments'
import { GraderForm } from './grader-form'
import { GraderDeleteDialog } from './grader-delete-dialog'

interface GraderDetailProps {
  id: string
}

export function GraderDetail({ id }: GraderDetailProps) {
  const navigate = useNavigate()
  const { data: grader, isLoading } = useGrader(id)
  const updateGrader = useUpdateGrader()
  const deleteGrader = useDeleteGrader()
  const { data: allExperiments } = useExperiments()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rubric, setRubric] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [validationError, setValidationError] = useState('')

  const affectedExperiments = (allExperiments ?? []).filter((exp) =>
    exp.graders?.some((eg) => eg.graderId === id),
  )

  const [syncedGraderId, setSyncedGraderId] = useState(grader?.id)
  const [syncedIsDirty, setSyncedIsDirty] = useState(isDirty)
  const justBecameClean = syncedIsDirty && !isDirty
  const graderIdChanged = grader?.id !== syncedGraderId

  // Sync server data → local state (only when not dirty, derived-state pattern)
  if (grader && !isDirty && (graderIdChanged || justBecameClean)) {
    setSyncedGraderId(grader.id)
    setSyncedIsDirty(isDirty)
    setName(grader.name)
    setDescription(grader.description ?? '')
    setRubric(grader.rubric ?? '')
  } else if (isDirty !== syncedIsDirty) {
    setSyncedIsDirty(isDirty)
  }

  function markDirty(field: 'name' | 'description' | 'rubric', value: string) {
    if (!grader) return
    const next = { name, description, rubric, [field]: value }
    const changed =
      next.name !== grader.name ||
      next.description !== (grader.description ?? '') ||
      next.rubric !== (grader.rubric ?? '')
    setIsDirty(changed)
  }

  async function handleSave() {
    if (!grader) return
    if (!name.trim()) {
      setValidationError('Name is required.')
      return
    }
    if (!rubric.trim()) {
      setValidationError('Rubric is required.')
      return
    }
    setValidationError('')
    await updateGrader.mutateAsync({
      id: grader.id,
      name: name.trim(),
      description: description.trim(),
      rubric: rubric.trim(),
    })
    setIsDirty(false)
  }

  async function handleDelete() {
    if (!grader) return
    await deleteGrader.mutateAsync(grader.id)
    navigate('/graders')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!grader) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[13px] text-muted-foreground">Grader not found</p>
      </div>
    )
  }

  const saveError = updateGrader.isError
    ? updateGrader.error instanceof Error
      ? updateGrader.error.message
      : 'Failed to save'
    : deleteGrader.isError
      ? deleteGrader.error instanceof Error
        ? deleteGrader.error.message
        : 'Failed to delete'
      : null

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/graders')}
          className="text-muted-foreground h-7 w-7 p-0"
        >
          <ArrowLeft size={16} />
        </Button>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          /
        </span>
        <h2 className="text-base font-semibold text-foreground">{grader.name}</h2>
      </div>

      <GraderForm
        grader={grader}
        name={name}
        description={description}
        rubric={rubric}
        isDirty={isDirty}
        validationError={validationError}
        onNameChange={(v) => {
          setName(v)
          markDirty('name', v)
          setValidationError('')
        }}
        onDescriptionChange={(v) => {
          setDescription(v)
          markDirty('description', v)
        }}
        onRubricChange={(v) => {
          setRubric(v)
          markDirty('rubric', v)
          setValidationError('')
        }}
        onSave={handleSave}
        onDeleteClick={() => setDeleteDialogOpen(true)}
        isSaving={updateGrader.isPending}
        saveError={saveError}
      />

      <GraderDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        graderName={grader.name}
        affectedExperiments={affectedExperiments.map((e) => e.name)}
        onConfirm={async () => {
          setDeleteDialogOpen(false)
          await handleDelete()
        }}
        isDeleting={deleteGrader.isPending}
      />
    </div>
  )
}
