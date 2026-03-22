import { useState, useRef, useCallback, useMemo } from 'react'
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

  // Tracks whether the next message is the first in a conversation.
  // Used by the API to inject the system/user prompt template on the first turn.
  const isFirstMessage = useRef<boolean>(true)

  // Transport is recreated when selectedVersionId changes so the body carries
  // the correct versionId. isFirstMessage is read via a callback that runs at
  // request time (sendMessage), never during render.
  const transport = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
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
          isFirstMessage: isFirstMessage.current,
        }),
      }),
    [promptId, selectedVersionId],
  )

  const chat = useChat({ transport })

  const append = useCallback(
    async (text: string) => {
      await chat.sendMessage({ text })
      isFirstMessage.current = false
    },
    [chat],
  )

  const selectVersion = useCallback(
    (id: string) => {
      isFirstMessage.current = true
      setSelectedVersionId(id)
      chat.setMessages([])
    },
    [chat],
  )

  const reset = useCallback(() => {
    isFirstMessage.current = true
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
