import { useState, useCallback, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from '@ai-sdk/react'
import type { PromptVersion } from './use-prompts'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

interface UsePlaygroundOptions {
  promptId: string
  versions: PromptVersion[]
}

export function usePlayground({ promptId, versions }: UsePlaygroundOptions) {
  const [selectedVersionId, setSelectedVersionId] = useState(versions[0]?.id ?? '')

  // Transport is recreated when selectedVersionId changes so the body carries
  // the correct versionId.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL}/prompts/${promptId}/playground`,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages: (messages as UIMessage[]).map((m) => ({
              role: m.role,
              content: m.parts
                .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
                .map((p) => p.text)
                .join(''),
            })),
          },
        }),
        body: () => ({
          versionId: selectedVersionId,
        }),
      }),
    [promptId, selectedVersionId],
  )

  const chat = useChat({ transport })

  const append = useCallback(
    async (text: string) => {
      await chat.sendMessage({ text })
    },
    [chat],
  )

  const selectVersion = useCallback(
    (id: string) => {
      setSelectedVersionId(id)
      chat.setMessages([])
    },
    [chat],
  )

  const reset = useCallback(() => {
    chat.setMessages([])
  }, [chat])

  const selectedVersion = versions.find((v) => v.id === selectedVersionId)

  return {
    messages: chat.messages,
    selectedVersionId,
    selectedVersion,
    selectVersion,
    reset,
    append,
    stop: chat.stop,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    error: chat.error,
  }
}
