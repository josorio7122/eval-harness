import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { Grader } from '@/hooks/use-graders'

interface GraderSelectorProps {
  graders: Grader[] | undefined
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function GraderSelector({ graders, selectedIds, onToggle }: GraderSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        Graders <span className="text-destructive">*</span>
      </Label>
      <div className="border border-border rounded-md max-h-[160px] overflow-y-auto overflow-x-hidden bg-card">
        {!graders || graders.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">
            No graders available. Create graders first.
          </p>
        ) : (
          graders.map((grader) => {
            const selected = selectedIds.includes(grader.id)
            return (
              <div
                key={grader.id}
                className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0 hover:bg-accent"
              >
                <Checkbox
                  id={grader.id}
                  checked={selected}
                  onCheckedChange={() => onToggle(grader.id)}
                />
                <Label
                  htmlFor={grader.id}
                  className="cursor-pointer flex-1 min-w-0 flex-col items-start gap-0.5 text-sm font-normal"
                >
                  <span className="font-medium truncate max-w-full">{grader.name}</span>
                  {grader.description && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-full">
                      {grader.description}
                    </span>
                  )}
                </Label>
              </div>
            )
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} grader{selectedIds.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}
