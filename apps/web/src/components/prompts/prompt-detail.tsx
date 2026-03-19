import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import {
  usePrompt,
  useCreatePromptVersion,
  useDeletePrompt,
  useUpdatePromptName,
} from '@/hooks/use-prompts'
import { PageHeader } from '@/components/shared/page-header'
import { Input } from '@/components/ui/input'
import { PromptEditor } from './prompt-editor'
import { PromptVersionHistory } from './prompt-version-history'
import { PromptDeleteDialog } from './prompt-delete-dialog'

interface PromptDetailProps {
  id: string
}

interface ModelParamsValue {
  temperature?: number
  maxTokens?: number
  topP?: number
}

export function PromptDetail({ id }: PromptDetailProps) {
  const navigate = useNavigate()
  const { data: prompt, isLoading } = usePrompt(id)
  const createPromptVersion = useCreatePromptVersion()
  const deletePrompt = useDeletePrompt()
  const updatePromptName = useUpdatePromptName()

  const [name, setName] = useState('')
  const [syncedNameId, setSyncedNameId] = useState<string | undefined>(undefined)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [modelId, setModelId] = useState('')
  const [modelParams, setModelParams] = useState<ModelParamsValue>({})
  const [isDirty, setIsDirty] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Derived-state sync: sync server data → local only when not dirty
  const [syncedPromptId, setSyncedPromptId] = useState(prompt?.id)
  const [syncedIsDirty, setSyncedIsDirty] = useState(isDirty)
  const justBecameClean = syncedIsDirty && !isDirty
  const promptIdChanged = prompt?.id !== syncedPromptId

  if (prompt && !isDirty && (promptIdChanged || justBecameClean)) {
    const latest = prompt.versions[0]
    setSyncedPromptId(prompt.id)
    setSyncedIsDirty(isDirty)
    if (latest) {
      setSystemPrompt(latest.systemPrompt)
      setUserPrompt(latest.userPrompt)
      setModelId(latest.modelId)
      setModelParams(latest.modelParams ?? {})
    }
  } else if (isDirty !== syncedIsDirty) {
    setSyncedIsDirty(isDirty)
  }

  // Sync name from server when prompt first loads or changes
  if (prompt && prompt.id !== syncedNameId) {
    setSyncedNameId(prompt.id)
    setName(prompt.name)
  }

  function markDirty(
    field: 'systemPrompt' | 'userPrompt' | 'modelId' | 'modelParams',
    value: string | ModelParamsValue,
  ) {
    if (!prompt) return
    const latest = prompt.versions[0]
    if (!latest) return
    const next = { systemPrompt, userPrompt, modelId, modelParams, [field]: value }
    const changed =
      next.systemPrompt !== latest.systemPrompt ||
      next.userPrompt !== latest.userPrompt ||
      next.modelId !== latest.modelId ||
      JSON.stringify(next.modelParams) !== JSON.stringify(latest.modelParams ?? {})
    setIsDirty(changed)
  }

  function handleSelectVersion(version: number) {
    if (!prompt) return
    const latest = prompt.versions[0]
    const isLatest = latest?.version === version
    if (isLatest) {
      setSelectedVersion(null)
      // Restore latest editable state
      setSystemPrompt(latest.systemPrompt)
      setUserPrompt(latest.userPrompt)
      setModelId(latest.modelId)
      setModelParams(latest.modelParams ?? {})
      setIsDirty(false)
    } else {
      setSelectedVersion(version)
      const v = prompt.versions.find((pv) => pv.version === version)
      if (v) {
        setSystemPrompt(v.systemPrompt)
        setUserPrompt(v.userPrompt)
        setModelId(v.modelId)
        setModelParams(v.modelParams ?? {})
        setIsDirty(false)
      }
    }
  }

  async function handleRenameSave() {
    if (!prompt) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === prompt.name) return
    await updatePromptName.mutateAsync({ id: prompt.id, name: trimmed })
  }

  async function handleSave() {
    if (!prompt) return
    await createPromptVersion.mutateAsync({
      id: prompt.id,
      systemPrompt,
      userPrompt,
      modelId,
      modelParams,
    })
    setIsDirty(false)
    setSelectedVersion(null)
  }

  async function handleDelete() {
    if (!prompt) return
    await deletePrompt.mutateAsync(prompt.id)
    navigate('/prompts')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[13px] text-muted-foreground">Prompt not found</p>
      </div>
    )
  }

  const isReadOnly = selectedVersion !== null

  const saveError = createPromptVersion.isError
    ? createPromptVersion.error instanceof Error
      ? createPromptVersion.error.message
      : 'Failed to save'
    : deletePrompt.isError
      ? deletePrompt.error instanceof Error
        ? deletePrompt.error.message
        : 'Failed to delete'
      : null

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader onBack={() => navigate('/prompts')} className="flex-shrink-0">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleRenameSave}
          className="text-base font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0 shadow-none"
        />
      </PageHeader>

      <div className="flex-1 overflow-auto">
        <PromptEditor
          systemPrompt={systemPrompt}
          userPrompt={userPrompt}
          modelId={modelId}
          modelParams={modelParams}
          readOnly={isReadOnly}
          isDirty={isDirty}
          isSaving={createPromptVersion.isPending}
          viewingVersion={selectedVersion}
          onSystemPromptChange={(v) => {
            setSystemPrompt(v)
            markDirty('systemPrompt', v)
          }}
          onUserPromptChange={(v) => {
            setUserPrompt(v)
            markDirty('userPrompt', v)
          }}
          onModelIdChange={(v) => {
            setModelId(v)
            markDirty('modelId', v)
          }}
          onModelParamsChange={(v) => {
            setModelParams(v)
            markDirty('modelParams', v)
          }}
          onSave={handleSave}
          onDeleteClick={() => setDeleteDialogOpen(true)}
          saveError={saveError}
        />

        {prompt.versions.length > 0 && (
          <div className="px-6 pb-6">
            <PromptVersionHistory
              versions={prompt.versions}
              selectedVersion={selectedVersion}
              onSelectVersion={handleSelectVersion}
            />
          </div>
        )}
      </div>

      <PromptDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        promptName={prompt.name}
        onConfirm={async () => {
          setDeleteDialogOpen(false)
          await handleDelete()
        }}
        isDeleting={deletePrompt.isPending}
      />
    </div>
  )
}
