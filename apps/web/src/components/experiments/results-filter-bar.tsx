import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/shared/section-label'
import type { ResultsFilter } from './results-table'

interface ResultsFilterBarProps {
  filter: ResultsFilter
  onFilterChange: (filter: ResultsFilter) => void
  filteredCount: number
  totalCount: number
}

const filterLabels: Record<ResultsFilter, string> = {
  all: 'All',
  'passed-all': 'Passed All',
  'any-failed': 'Any Failed',
}

export function ResultsFilterBar({
  filter,
  onFilterChange,
  filteredCount,
  totalCount,
}: ResultsFilterBarProps) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-card flex-shrink-0">
      <SectionLabel className="mr-1">Filter</SectionLabel>
      {(['all', 'passed-all', 'any-failed'] as ResultsFilter[]).map((opt) => {
        const isActive = filter === opt
        return (
          <Button
            key={opt}
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onFilterChange(opt)}
            className="h-6 px-2 text-[11px]"
          >
            {filterLabels[opt]}
          </Button>
        )
      })}
      {filter !== 'all' && (
        <span className="font-mono text-xs text-muted-foreground tabular-nums ml-1">
          {filteredCount}/{totalCount}
        </span>
      )}
    </div>
  )
}
