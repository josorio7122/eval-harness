import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, Trash2 } from 'lucide-react'
import { useGrader, useUpdateGrader, useDeleteGrader } from '@/hooks/use-graders'

interface GraderDetailProps {
  id: string
}

export function GraderDetail({ id }: GraderDetailProps) {
  const navigate = useNavigate()
  const { data: grader, isLoading } = useGrader(id)
  const updateGrader = useUpdateGrader()
  const deleteGrader = useDeleteGrader()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rubric, setRubric] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const rubricRef = useRef<HTMLTextAreaElement>(null)

  // Sync server data → local state (only when not dirty)
  useEffect(() => {
    if (grader && !isDirty) {
      setName(grader.name)
      setDescription(grader.description ?? '')
      setRubric(grader.rubric ?? '')
    }
  }, [grader, isDirty])

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
    if (!confirm(`Delete grader "${grader.name}"? This cannot be undone.`)) return
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
              onChange={e => {
                setName(e.target.value)
                markDirty('name', e.target.value)
              }}
              className="h-[32px] px-3 text-[13px] font-medium outline-none transition-colors w-full"
              style={{
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--fg-primary)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
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
              onChange={e => {
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
              onFocus={e => (e.target.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
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
            onChange={e => {
              setRubric(e.target.value)
              markDirty('rubric', e.target.value)
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
            onFocus={e => (e.target.style.borderColor = 'var(--border-focus)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
          />
        </div>

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
            onClick={handleDelete}
            disabled={deleteGrader.isPending}
            className="flex items-center gap-1.5 h-[32px] px-3 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'transparent',
              color: 'var(--fg-muted)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--fail-fg)'
              e.currentTarget.style.borderColor = 'var(--fail)'
            }}
            onMouseLeave={e => {
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
    </div>
  )
}
