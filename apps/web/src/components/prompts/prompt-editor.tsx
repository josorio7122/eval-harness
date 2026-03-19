import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/shared/section-label'
import { ModelSelector } from '@/components/shared/model-selector'
import { ModelParams } from '@/components/shared/model-params'

interface ModelParamsValue {
  temperature?: number
  maxTokens?: number
  topP?: number
}

interface PromptEditorProps {
  systemPrompt: string
  userPrompt: string
  modelId: string
  modelParams: ModelParamsValue
  readOnly: boolean
  isDirty: boolean
  isSaving: boolean
  viewingVersion?: number | null
  onSystemPromptChange: (v: string) => void
  onUserPromptChange: (v: string) => void
  onModelIdChange: (v: string) => void
  onModelParamsChange: (v: ModelParamsValue) => void
  onSave: () => void
  onDeleteClick: () => void
  saveError: string | null
}

export function PromptEditor({
  systemPrompt,
  userPrompt,
  modelId,
  modelParams,
  readOnly,
  isDirty,
  isSaving,
  viewingVersion,
  onSystemPromptChange,
  onUserPromptChange,
  onModelIdChange,
  onModelParamsChange,
  onSave,
  onDeleteClick,
  saveError,
}: PromptEditorProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-5 p-6 border-l-2 transition-colors duration-150',
        isDirty && !readOnly ? 'border-l-destructive' : 'border-l-transparent',
      )}
    >
      {readOnly && viewingVersion != null && (
        <p className="text-[12px] text-muted-foreground italic">Viewing version {viewingVersion}</p>
      )}

      {/* System Prompt */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>System Prompt</SectionLabel>
        <Textarea
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          disabled={readOnly}
          rows={5}
          className="font-mono text-sm resize-none"
          placeholder="You are a helpful assistant…"
        />
      </div>

      {/* User Prompt */}
      <div className="flex flex-col gap-1.5">
        <Label>
          <SectionLabel>User Prompt</SectionLabel>
        </Label>
        <Textarea
          value={userPrompt}
          onChange={(e) => onUserPromptChange(e.target.value)}
          disabled={readOnly}
          rows={5}
          className="font-mono text-sm resize-none"
          placeholder="{{input}}"
        />
      </div>

      {/* Model */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Model</SectionLabel>
        <ModelSelector value={modelId} onChange={onModelIdChange} disabled={readOnly} />
      </div>

      {/* Model Params */}
      <ModelParams
        temperature={modelParams.temperature}
        maxTokens={modelParams.maxTokens}
        topP={modelParams.topP}
        onChange={onModelParamsChange}
        disabled={readOnly}
      />

      {/* Save error */}
      {saveError && <p className="text-destructive text-xs">{saveError}</p>}

      {/* Action row */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onDeleteClick}
          className="hover:border-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 />
          Delete
        </Button>

        {!readOnly && (
          <div className="flex items-center gap-2">
            {isDirty && <span className="text-destructive text-xs">Unsaved changes</span>}
            <Button size="sm" onClick={onSave} disabled={!isDirty || isSaving}>
              {isSaving ? 'Saving…' : 'Save new version'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
