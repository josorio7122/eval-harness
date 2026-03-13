import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { useCreateGrader } from '@/hooks/use-graders'

interface CreateGraderDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

export function CreateGraderDialog({ open, onClose, onCreated }: CreateGraderDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rubric, setRubric] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const createGrader = useCreateGrader()

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setRubric('')
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="fixed z-50 top-1/2 left-1/2 w-[480px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: 'var(--bg-surface-1)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        {/* Dialog header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fg-primary)' }}>
            New Grader
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-[24px] h-[24px] rounded transition-colors"
            style={{
              color: 'var(--fg-muted)',
              borderRadius: 'var(--radius-md)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--fg-primary)'
              e.currentTarget.style.background = 'var(--bg-surface-2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--fg-muted)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[12px] font-medium"
              style={{ color: 'var(--fg-secondary)' }}
            >
              Name <span style={{ color: 'var(--error-fg)' }}>*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Relevance grader"
              required
              className="h-[32px] px-3 text-[13px] outline-none transition-colors"
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
              className="text-[12px] font-medium"
              style={{ color: 'var(--fg-secondary)' }}
            >
              Description{' '}
              <span className="text-[11px] font-normal" style={{ color: 'var(--fg-muted)' }}>
                (optional)
              </span>
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this grader evaluate?"
              className="h-[32px] px-3 text-[13px] outline-none transition-colors"
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

          {/* Rubric */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[12px] font-medium"
              style={{ color: 'var(--fg-secondary)' }}
            >
              Rubric <span style={{ color: 'var(--error-fg)' }}>*</span>
            </label>
            <textarea
              value={rubric}
              onChange={e => setRubric(e.target.value)}
              placeholder="Describe the grading criteria..."
              required
              rows={5}
              className="px-3 py-2 text-[12px] outline-none resize-none transition-colors"
              style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--fg-primary)',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.6,
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--border-focus)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
            />
          </div>

          {/* Error */}
          {createGrader.isError && (
            <p className="text-[12px]" style={{ color: 'var(--error-fg)' }}>
              {createGrader.error instanceof Error
                ? createGrader.error.message
                : 'Failed to create grader'}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-[32px] px-3 text-[13px] font-medium transition-colors"
              style={{
                background: 'transparent',
                color: 'var(--fg-secondary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--fg-primary)'
                e.currentTarget.style.background = 'var(--bg-surface-2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--fg-secondary)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !rubric.trim() || createGrader.isPending}
              className="h-[32px] px-3 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--fg-primary)',
                color: 'var(--fg-inverted)',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-md)',
              }}
              onMouseEnter={e => {
                if (!createGrader.isPending) {
                  e.currentTarget.style.opacity = '0.85'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              {createGrader.isPending ? 'Creating…' : 'Create grader'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
