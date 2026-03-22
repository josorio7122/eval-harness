import { useState } from 'react'
import type { PromptWithVersions } from './use-prompts'

interface ModelParamsValue {
  temperature?: number
  maxTokens?: number
  topP?: number
}

export function usePromptDetailState(prompt: PromptWithVersions | undefined) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [syncedNameId, setSyncedNameId] = useState<string | undefined>(undefined)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [modelId, setModelId] = useState('')
  const [modelParams, setModelParams] = useState<ModelParamsValue>({})
  const [isDirty, setIsDirty] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [playgroundOpen, setPlaygroundOpen] = useState(false)

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
      next.modelParams?.temperature !== latest.modelParams?.temperature ||
      next.modelParams?.maxTokens !== latest.modelParams?.maxTokens ||
      next.modelParams?.topP !== latest.modelParams?.topP
    setIsDirty(changed)
  }

  function handleSelectVersion(version: number) {
    if (!prompt) return
    const latest = prompt.versions[0]
    const isLatest = latest?.version === version
    if (isLatest) {
      setSelectedVersion(null)
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

  return {
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
  }
}
