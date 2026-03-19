import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useCreatePrompt } from '@/hooks/use-prompts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SectionLabel } from '@/components/shared/section-label'
import { ModelSelector } from '@/components/shared/model-selector'
import { ModelParams } from '@/components/shared/model-params'

interface ModelParamsValue {
  temperature?: number
  maxTokens?: number
  topP?: number
}

interface CreatePromptDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

export function CreatePromptDialog({ open, onClose, onCreated }: CreatePromptDialogProps) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [modelId, setModelId] = useState('')
  const [modelParams, setModelParams] = useState<ModelParamsValue>({})
  const [prevOpen, setPrevOpen] = useState(open)
  const [submitted, setSubmitted] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const createPrompt = useCreatePrompt()

  // Reset form when dialog opens (derived-state pattern)
  if (open && !prevOpen) {
    setPrevOpen(true)
    setName('')
    setSystemPrompt('')
    setUserPrompt('')
    setModelId('')
    setModelParams({})
    setSubmitted(false)
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
    setSubmitted(true)
    if (!name.trim() || !modelId) return
    try {
      const result = await createPrompt.mutateAsync({
        name: name.trim(),
        systemPrompt,
        userPrompt,
        modelId,
        modelParams,
      })
      const created =
        (result as { data?: { id: string }; id?: string }).data ?? (result as { id?: string })
      const newId = created?.id ?? ''
      onCreated?.(newId)
      if (newId) navigate(`/prompts/${newId}`)
      onClose()
    } catch {
      // error handled by mutation state
    }
  }

  const canSubmit = name.trim() && modelId

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="sm:max-w-[520px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>New Prompt</DialogTitle>
        </DialogHeader>

        <form id="create-prompt" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <SectionLabel>
              Name <span className="text-destructive">*</span>
            </SectionLabel>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. summarise-v1"
              required
            />
            {submitted && !name.trim() && (
              <p className="text-destructive text-xs">Name is required</p>
            )}
          </div>

          {/* System Prompt */}
          <div className="flex flex-col gap-1.5">
            <SectionLabel>System Prompt</SectionLabel>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant…"
              rows={3}
              className="font-mono text-sm resize-none"
            />
          </div>

          {/* User Prompt */}
          <div className="flex flex-col gap-1.5">
            <SectionLabel>User Prompt</SectionLabel>
            <Textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="{{input}}"
              rows={3}
              className="font-mono text-sm resize-none"
            />
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1.5">
            <SectionLabel>
              Model <span className="text-destructive">*</span>
            </SectionLabel>
            <ModelSelector value={modelId} onChange={setModelId} />
            {submitted && !modelId && <p className="text-destructive text-xs">Model is required</p>}
          </div>

          {/* Model Params */}
          <ModelParams
            temperature={modelParams.temperature}
            maxTokens={modelParams.maxTokens}
            topP={modelParams.topP}
            onChange={setModelParams}
          />

          {/* Error */}
          {createPrompt.isError && (
            <p className="text-destructive text-xs">
              {createPrompt.error instanceof Error
                ? createPrompt.error.message
                : 'Failed to create prompt'}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-prompt"
            disabled={!canSubmit || createPrompt.isPending}
          >
            {createPrompt.isPending ? 'Creating…' : 'Create prompt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
