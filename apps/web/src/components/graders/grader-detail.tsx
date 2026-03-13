import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, Trash2 } from 'lucide-react'
import { useGrader, useUpdateGrader, useDeleteGrader } from '@/hooks/use-graders'
import { useExperiments } from '@/hooks/use-experiments'

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
  const rubricRef = useRef<HTMLTextAreaElement>(null)

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

  // Auto-grow textarea
  const autoGrow = useCallback(() => {
    const el = rubricRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  useEffect(() => {
    autoGrow()
  }, [rubric, autoGrow])

  function markDirty(field: 'name' | 'description' | 'rubric', value: string) {
    if (!grader) return
    const next = {
      name,
      description,
      rubric,
      [field]: value,
    }
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
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--fg-muted)' }} />
      </div>
    )
  }

  if (!grader) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>
          Grader not found
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Form panel — unsaved changes: amber left-border */}
      <div
        className="flex-1 flex flex-col gap-5 p-6"
        style={{
          borderLeft: isDirty ? '2px solid var(--error)' : '2px solid transparent',
          transition: 'border-color 150ms ease-out',
        }}
      >
        {/* Header: name + description */}
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              Name
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                markDirty('name', e.target.value)
                setValidationError('')
              }}
              className="h-[32px] px-3 text-[13px] font-medium outline-none transition-colors w-full"
              style={{
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--fg-primary)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--border-focus)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              Description
            </label>
            <input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                markDirty('description', e.target.value)
              }}
              placeholder="What does this grader evaluate?"
              className="h-[32px] px-3 text-[13px] outline-none transition-colors w-full"
              style={{
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--fg-primary)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--border-focus)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
            />
          </div>
        </div>

        {/* Rubric editor */}
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex items-center justify-between">
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              Rubric
            </label>
            <span
              className="text-[11px] font-medium px-[6px] py-[2px]"
              style={{
                background: 'var(--accent-subtle)',
                color: 'var(--accent)',
                borderRadius: 'var(--radius-sm)',
                letterSpacing: '0.03em',
              }}
            >
              LLM
            </span>
          </div>
          <textarea
            ref={rubricRef}
            value={rubric}
            onChange={(e) => {
              setRubric(e.target.value)
              markDirty('rubric', e.target.value)
              setValidationError('')
              autoGrow()
            }}
            placeholder="Describe the grading criteria and scoring instructions..."
            className="px-4 py-3 text-[12px] outline-none resize-none overflow-hidden"
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--fg-primary)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.7,
              minHeight: '200px',
              transition: 'border-color 150ms ease-out',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--border-focus)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
          />
        </div>

        {/* Validation error */}
        {validationError && (
          <p className="text-[12px]" style={{ color: 'var(--error-fg)' }}>
            {validationError}
          </p>
        )}

        {/* Error */}
        {(updateGrader.isError || deleteGrader.isError) && (
          <p className="text-[12px]" style={{ color: 'var(--error-fg)' }}>
            {updateGrader.isError
              ? updateGrader.error instanceof Error
                ? updateGrader.error.message
                : 'Failed to save'
              : deleteGrader.error instanceof Error
                ? deleteGrader.error.message
                : 'Failed to delete'}
          </p>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between pt-1">
          {/* Delete */}
          <button
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteGrader.isPending}
            className="flex items-center gap-1.5 h-[32px] px-3 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'transparent',
              color: 'var(--fg-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fail-fg)'
              e.currentTarget.style.borderColor = 'var(--fail)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-muted)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
          >
            <Trash2 size={13} />
            {deleteGrader.isPending ? 'Deleting…' : 'Delete'}
          </button>

          {/* Save */}
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-[12px]" style={{ color: 'var(--error-fg)' }}>
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || updateGrader.isPending}
              className="h-[32px] px-4 text-[13px] font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isDirty ? 'var(--fg-primary)' : 'var(--bg-surface-2)',
                color: isDirty ? 'var(--fg-inverted)' : 'var(--fg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                transition: 'background 150ms ease-out, color 150ms ease-out',
              }}
            >
              {updateGrader.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Grader Confirmation Dialog */}
      {deleteDialogOpen && grader && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteDialogOpen(false)
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface-1)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              width: '400px',
              maxWidth: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3
              style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}
            >
              Delete grader "{grader.name}"?
            </h3>

            {affectedExperiments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '12px', color: 'var(--error-fg)', margin: 0 }}>
                  The following experiments use this grader and will also be permanently deleted
                  along with all their evaluation results:
                </p>
                <ul
                  style={{
                    margin: 0,
                    padding: '8px 12px',
                    background: 'var(--fail-subtle)',
                    border: '1px solid var(--fail)',
                    borderRadius: 'var(--radius-md)',
                    listStyleType: 'disc',
                    paddingLeft: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {affectedExperiments.map((exp) => (
                    <li
                      key={exp.id}
                      style={{
                        fontSize: '12px',
                        color: 'var(--fail-fg)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {exp.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', margin: 0 }}>
                This action cannot be undone.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setDeleteDialogOpen(false)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  fontSize: '12px',
                  background: 'transparent',
                  color: 'var(--fg-secondary)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleteDialogOpen(false)
                  await handleDelete()
                }}
                disabled={deleteGrader.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '32px',
                  padding: '0 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: 'var(--fail-subtle)',
                  color: 'var(--fail-fg)',
                  border: '1px solid var(--fail)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  opacity: deleteGrader.isPending ? 0.6 : 1,
                }}
              >
                <Trash2 size={12} />
                {deleteGrader.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
