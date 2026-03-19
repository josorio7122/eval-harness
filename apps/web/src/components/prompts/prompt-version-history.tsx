import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { SectionLabel } from '@/components/shared/section-label'
import { getModelDisplayName } from '@/lib/models'
import type { PromptVersion } from '@/hooks/use-prompts'

interface PromptVersionHistoryProps {
  versions: PromptVersion[]
  selectedVersion: number | null
  onSelectVersion: (version: number) => void
}

export function PromptVersionHistory({
  versions,
  selectedVersion,
  onSelectVersion,
}: PromptVersionHistoryProps) {
  if (versions.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Version History</SectionLabel>
      <div className="flex flex-col gap-1">
        {versions.map((v, i) => {
          const isSelected = selectedVersion === v.version
          const isLatest = i === 0
          const date = new Date(v.createdAt).toLocaleDateString()

          return (
            <button
              key={v.id}
              onClick={() => onSelectVersion(v.version)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors',
                isSelected
                  ? 'bg-card text-foreground'
                  : 'text-muted-foreground hover:bg-card hover:text-foreground',
              )}
            >
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                v{v.version}
              </Badge>
              <span className="flex-1 truncate">{getModelDisplayName(v.modelId)}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">{date}</span>
              {isLatest && (
                <span className="text-[10px] font-medium text-primary shrink-0">Current</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
