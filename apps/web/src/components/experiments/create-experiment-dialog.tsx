import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { useCreateExperiment } from '@/hooks/use-experiments'
import { useDatasets } from '@/hooks/use-datasets'
import { useGraders } from '@/hooks/use-graders'

interface CreateExperimentDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

export function CreateExperimentDialog({
  open,
  onClose,
  onCreated,
}: CreateExperimentDialogProps) {
  const [name, setName] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [graderIds, setGraderIds] = useState<string[]>([])
  const nameRef = useRef<HTMLInputElement>(null)

  const createExperiment = useCreateExperiment()
  const { data: datasets } = useDatasets()
  const { data: graders } = useGraders()

  useEffect(() => {
    if (open) {
      setName('')
      setDatasetId('')
      setGraderIds([])
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  function toggleGrader(id: string) {
    setGraderIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    )
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
      const created = (result as { data?: { id: string } }).data
      onCreated?.(created?.id ?? '')
      onClose()
    } catch {
      // error handled by mutation state
    }
  }

  const canSubmit = name.trim() && datasetId && graderIds.length > 0

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
        className="fixed z-50 top-1/2 left-1/2 w-[440px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: 'var(--bg-surface-1)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--fg-primary)' }}>
            New Experiment
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-[24px] h-[24px] rounded transition-colors"
            style={{ color: 'var(--fg-muted)', borderRadius: 'var(--radius-md)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--fg-primary)'
              e.currentTarget.style.background = 'var(--bg-surface-2)'
            }}
            onMouseLeave={(e) => {
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
            <label className="text-[12px] font-medium" style={{ color: 'var(--fg-secondary)' }}>
              Name <span style={{ color: 'var(--error-fg)' }}>*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. baseline-v1"
              required
              className="h-[32px] px-3 text-[13px] outline-none transition-colors"
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

          {/* Dataset */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: 'var(--fg-secondary)' }}>
              Dataset <span style={{ color: 'var(--error-fg)' }}>*</span>
            </label>
            <select
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              required
              className="h-[32px] px-3 text-[13px] outline-none transition-colors appearance-none"
              style={{
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                color: datasetId ? 'var(--fg-primary)' : 'var(--fg-muted)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--border-focus)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
            >
              <option value="" disabled>
                Select a dataset…
              </option>
              {datasets?.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </select>
          </div>

          {/* Graders */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium" style={{ color: 'var(--fg-secondary)' }}>
              Graders <span style={{ color: 'var(--error-fg)' }}>*</span>
            </label>
            <div
              style={{
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                maxHeight: '160px',
                overflowY: 'auto',
              }}
            >
              {!graders || graders.length === 0 ? (
                <div
                  style={{
                    padding: '12px',
                    fontSize: '12px',
                    color: 'var(--fg-muted)',
                  }}
                >
                  No graders available. Create graders first.
                </div>
              ) : (
                graders.map((grader) => {
                  const selected = graderIds.includes(grader.id)
                  return (
                    <label
                      key={grader.id}
                      className="flex items-center gap-3 px-3 py-[7px] cursor-pointer"
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: selected ? 'var(--accent-subtle)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!selected)
                          e.currentTarget.style.background = 'var(--bg-surface-3)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = selected
                          ? 'var(--accent-subtle)'
                          : 'transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleGrader(grader.id)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[13px] font-medium truncate"
                          style={{ color: 'var(--fg-primary)' }}
                        >
                          {grader.name}
                        </div>
                        {grader.description && (
                          <div
                            className="text-[11px] truncate"
                            style={{ color: 'var(--fg-tertiary)' }}
                          >
                            {grader.description}
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })
              )}
            </div>
            {graderIds.length > 0 && (
              <span className="text-[11px]" style={{ color: 'var(--fg-tertiary)' }}>
                {graderIds.length} grader{graderIds.length !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          {/* Error */}
          {createExperiment.isError && (
            <p className="text-[12px]" style={{ color: 'var(--error-fg)' }}>
              {createExperiment.error instanceof Error
                ? createExperiment.error.message
                : 'Failed to create experiment'}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--fg-primary)'
                e.currentTarget.style.background = 'var(--bg-surface-2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--fg-secondary)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || createExperiment.isPending}
              className="h-[32px] px-3 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--fg-primary)',
                color: 'var(--fg-inverted)',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-md)',
              }}
              onMouseEnter={(e) => {
                if (!createExperiment.isPending) e.currentTarget.style.opacity = '0.85'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              {createExperiment.isPending ? 'Creating…' : 'Create experiment'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
