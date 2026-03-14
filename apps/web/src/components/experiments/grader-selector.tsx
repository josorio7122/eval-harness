import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Command, CommandEmpty, CommandItem, CommandList } from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Grader } from '@/hooks/use-graders'
import { cn } from '@/lib/utils'

interface GraderSelectorProps {
  graders: Grader[] | undefined
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function GraderSelector({ graders, selectedIds, onToggle }: GraderSelectorProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        Graders <span className="text-destructive">*</span>
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          role="combobox"
          aria-expanded={open}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'w-full justify-between font-normal',
          )}
        >
          {selectedIds.length === 0
            ? 'Select graders…'
            : `${selectedIds.length} grader${selectedIds.length !== 1 ? 's' : ''} selected`}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>No graders available.</CommandEmpty>
              {graders?.map((grader) => (
                <CommandItem
                  key={grader.id}
                  value={grader.name}
                  onSelect={() => onToggle(grader.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedIds.includes(grader.id) ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{grader.name}</span>
                    {grader.description && (
                      <span className="text-xs text-muted-foreground">{grader.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {graders
            ?.filter((g) => selectedIds.includes(g.id))
            .map((g) => (
              <Badge key={g.id} variant="secondary" className="text-xs">
                {g.name}
              </Badge>
            ))}
        </div>
      )}
    </div>
  )
}
