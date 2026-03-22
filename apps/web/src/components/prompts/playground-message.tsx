import type { UIMessage } from '@ai-sdk/react'
import { cn } from '@/lib/utils'

interface PlaygroundMessageProps {
  message: UIMessage
}

export function PlaygroundMessage({ message }: PlaygroundMessageProps) {
  const isUser = message.role === 'user'

  const textParts = message.parts.filter((p) => p.type === 'text')

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        {textParts.length > 0 ? (
          textParts.map((part, i) =>
            part.type === 'text' ? (
              <p key={i} className="whitespace-pre-wrap break-words">
                {part.text}
                {part.state === 'streaming' && (
                  <span className="ml-0.5 inline-block w-1.5 h-3.5 bg-current opacity-70 animate-pulse align-[-2px]" />
                )}
              </p>
            ) : null,
          )
        ) : (
          <span className="opacity-50 italic text-xs">…</span>
        )}
      </div>
    </div>
  )
}
