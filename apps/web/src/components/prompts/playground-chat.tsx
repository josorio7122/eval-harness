import { useEffect, useRef, useState } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { PlaygroundMessage } from './playground-message'

const SYSTEM_PROMPT_COLLAPSE_THRESHOLD = 200

interface PlaygroundChatProps {
  messages: UIMessage[]
  systemPrompt: string
}

export function PlaygroundChat({ messages, systemPrompt }: PlaygroundChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const isLong = systemPrompt.length > SYSTEM_PROMPT_COLLAPSE_THRESHOLD
  const [collapsed, setCollapsed] = useState(isLong)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
      {systemPrompt && (
        <div className="mx-4 mt-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 font-medium uppercase tracking-wider text-[10px]"
          >
            System prompt
            {isLong &&
              (collapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />)}
          </button>
          {!collapsed && (
            <p className="px-3 pb-3 whitespace-pre-wrap leading-relaxed">{systemPrompt}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 px-4 py-4 flex-1">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              Send a message to start testing this prompt
            </p>
          </div>
        ) : (
          messages.map((msg) => <PlaygroundMessage key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
