import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PromptVersion } from '@/hooks/use-prompts'
import { usePlayground } from '@/hooks/use-playground'
import { PlaygroundChat } from './playground-chat'
import { PlaygroundInput } from './playground-input'

interface PlaygroundPanelProps {
  open: boolean
  onClose: () => void
  promptId: string
  versions: PromptVersion[]
}

export function PlaygroundPanel({ open, onClose, promptId, versions }: PlaygroundPanelProps) {
  const {
    messages,
    selectedVersionId,
    selectedVersion,
    selectVersion,
    reset,
    append,
    stop,
    isLoading,
    error,
  } = usePlayground({ promptId, versions })

  const latestVersionId = versions[0]?.id

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150" />
        <DialogPrimitive.Popup className="fixed inset-y-0 right-0 z-50 flex w-[500px] flex-col bg-background ring-1 ring-foreground/10 shadow-xl duration-200 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right outline-none">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 shrink-0">
            <DialogPrimitive.Title className="text-sm font-semibold">
              Playground
            </DialogPrimitive.Title>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={reset} title="Reset conversation">
                <RotateCcw className="size-4" />
              </Button>
              <DialogPrimitive.Close
                render={<Button variant="ghost" size="icon-sm" />}
                onClick={onClose}
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Version picker */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 shrink-0">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider shrink-0">
              Version
            </span>
            <Select
              value={selectedVersionId}
              onValueChange={(v) => {
                if (v) selectVersion(v)
              }}
            >
              <SelectTrigger size="sm" className="flex-1 max-w-[280px]">
                <SelectValue placeholder="Select a version…">
                  {selectedVersion
                    ? `v${selectedVersion.version} — ${selectedVersion.modelId}${selectedVersion.id === latestVersionId ? ' (Current)' : ''}`
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version} — {v.modelId}
                    {v.id === latestVersionId && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">(Current)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chat area */}
          <PlaygroundChat
            key={selectedVersionId}
            messages={messages}
            systemPrompt={selectedVersion?.systemPrompt ?? ''}
            error={error}
          />

          {/* Input */}
          <PlaygroundInput
            onSend={append}
            onStop={stop}
            isLoading={isLoading}
            disabled={versions.length === 0}
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
