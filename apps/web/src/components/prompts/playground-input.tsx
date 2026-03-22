import { useState, useRef, type KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface PlaygroundInputProps {
  onSend: (message: string) => void
  onStop: () => void
  isLoading: boolean
  disabled?: boolean
}

export function PlaygroundInput({ onSend, onStop, isLoading, disabled }: PlaygroundInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = value.trim().length > 0 && !isLoading

  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Send a message… (Shift+Enter for newline)"
        disabled={disabled || isLoading}
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex justify-end gap-2">
        {isLoading && (
          <Button variant="outline" size="sm" onClick={onStop}>
            <Square />
            Stop
          </Button>
        )}
        <Button size="sm" onClick={handleSend} disabled={!canSend || disabled}>
          <Send />
          Send
        </Button>
      </div>
    </div>
  )
}
