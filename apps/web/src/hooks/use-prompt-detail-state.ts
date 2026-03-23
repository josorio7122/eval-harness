import { useState, useEffect } from 'react'
import type { PromptWithVersions } from './use-prompts'

interface ModelParamsValue {
  temperature?: number
  maxTokens?: number
  topP?: number
}

export function usePromptDetailState(prompt: PromptWithVersions | undefined) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [modelId, setModelId] = useState('')
  const [modelParams, setModelParams] = useState<ModelParamsValue>({})
  const [isDirty, setIsDirty] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [playgroundOpen, setPlaygroundOpen] = useState(false)

  // Sync form fields from server whenever the prompt ID changes (including return visits)
  useEffect(() => {
    if (prompt) {
      setName(prompt.name)
      const latest = prompt.versions[0]
      if (latest) {
        setSystemPrompt(latest.systemPrompt)
        setUserPrompt(latest.userPrompt)
        setModelId(latest.modelId)
        setModelParams(latest.modelParams ?? {})
      }
      setSelectedVersion(null)
      setIsDirty(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt?.id])

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
