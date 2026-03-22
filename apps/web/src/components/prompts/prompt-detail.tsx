import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import {
  usePrompt,
  useCreatePromptVersion,
  useDeletePrompt,
  useUpdatePromptName,
} from '@/hooks/use-prompts'
import { usePromptDetailState } from '@/hooks/use-prompt-detail-state'
import { PromptHeader } from './prompt-header'
import { PromptEditor } from './prompt-editor'
import { PromptVersionHistory } from './prompt-version-history'
import { PromptDeleteDialog } from './prompt-delete-dialog'
import { PlaygroundPanel } from './playground-panel'

interface PromptDetailProps {
  id: string
}

export function PromptDetail({ id }: PromptDetailProps) {
  const navigate = useNavigate()
  const { data: prompt, isLoading } = usePrompt(id)
  const createPromptVersion = useCreatePromptVersion()
  const deletePrompt = useDeletePrompt()
  const updatePromptName = useUpdatePromptName()

  const {
    name,
    setName,
    nameError,
    setNameError,
    systemPrompt,
    setSystemPrompt,
    userPrompt,
    setUserPrompt,
    modelId,
    setModelId,
    modelParams,
    setModelParams,
    isDirty,
    setIsDirty,
    selectedVersion,
    setSelectedVersion,
    deleteDialogOpen,
    setDeleteDialogOpen,
    playgroundOpen,
    setPlaygroundOpen,
    markDirty,
    handleSelectVersion,
  } = usePromptDetailState(prompt)

  async function handleRenameSave() {
    if (!prompt) return
    const trimmed = name.trim()
    if (!trimmed) {
      setName(prompt.name)
      setNameError('Name is required')
      return
    }
    if (trimmed === prompt.name) return
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
      <PromptHeader
        name={name}
        onNameChange={(v) => {
          setName(v)
          setNameError(null)
        }}
        onNameSave={handleRenameSave}
        onDeleteClick={() => setDeleteDialogOpen(true)}
        onPlaygroundClick={() => setPlaygroundOpen(true)}
        nameError={nameError}
      />

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

      {playgroundOpen && (
        <PlaygroundPanel
          open={true}
          onClose={() => setPlaygroundOpen(false)}
          promptId={id}
          versions={prompt.versions}
        />
      )}
    </div>
  )
}
