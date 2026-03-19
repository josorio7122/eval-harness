import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import type { Experiment, ExperimentOutput, ExperimentResult } from '@/hooks/use-experiments'
import { SectionLabel } from '@/components/shared/section-label'
import { ResultsFilterBar } from './results-filter-bar'
import { ResultsTableRow } from './results-table-row'

export type ResultsFilter = 'all' | 'passed-all' | 'any-failed'

interface ResultsTableProps {
  experiment: Experiment
  filter: ResultsFilter
  onFilterChange: (filter: ResultsFilter) => void
}

// Long-text attributes get wider max-width
const longAttrs = new Set(['input', 'prompt', 'expected_output', 'output', 'text', 'content'])

function formatAttributeName(attr: string): string {
  return attr.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function failCount(itemId: string, results: ExperimentResult[]): number {
  return results.filter(
    (r) => r.datasetRevisionItemId === itemId && (r.verdict === 'fail' || r.verdict === 'error'),
  ).length
}

export function ResultsTable({ experiment, filter, onFilterChange }: ResultsTableProps) {
  const graders = experiment.graders ?? []
  const items = experiment.revision?.items ?? []
  const results = experiment.results ?? []
  const attributes = experiment.revision?.attributes ?? []
  const outputs: ExperimentOutput[] = experiment.outputs ?? []
  const outputMap = new Map(outputs.map((o) => [o.datasetRevisionItemId, o]))

  // Sort items: fail count descending (failures float to top)
  const sortedItems = [...items].sort((a, b) => failCount(b.id, results) - failCount(a.id, results))

  // Compute filtered item IDs and filtered results for pass-rate display
  const filteredItemIds = new Set(
    sortedItems
      .filter((item) => {
        if (filter === 'all') return true
        const itemResults = results.filter((r) => r.datasetRevisionItemId === item.id)
        const graderCount = graders.length
        if (filter === 'passed-all') {
          const passes = itemResults.filter((r) => r.verdict === 'pass').length
          return passes === graderCount && graderCount > 0
        }
        if (filter === 'any-failed') {
          return itemResults.some((r) => r.verdict === 'fail' || r.verdict === 'error')
        }
        return true
      })
      .map((i) => i.id),
  )
  const filteredResults = results.filter((r) => filteredItemIds.has(r.datasetRevisionItemId))

  // Apply filter
  const filteredItems = sortedItems.filter((item) => {
    if (filter === 'all') return true
    const itemResults = results.filter((r) => r.datasetRevisionItemId === item.id)
    const graderCount = graders.length
    if (filter === 'passed-all') {
      const passes = itemResults.filter((r) => r.verdict === 'pass').length
      return passes === graderCount && graderCount > 0
    }
    if (filter === 'any-failed') {
      return itemResults.some((r) => r.verdict === 'fail' || r.verdict === 'error')
    }
    return true
  })

  if (items.length === 0 || graders.length === 0) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground/70 text-sm">
        No data to display.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto relative flex flex-col">
      <ResultsFilterBar
        filter={filter}
        onFilterChange={onFilterChange}
        filteredCount={filteredItems.length}
        totalCount={items.length}
      />

      <div className="flex-1 overflow-auto relative">
        <Table className="border-collapse" style={{ tableLayout: 'auto' }}>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-card">
              {attributes.map((attr, idx) => {
                const isLast = idx === attributes.length - 1
                return (
                  <TableHead
                    key={attr}
                    className={`border-b border-border whitespace-nowrap px-3 py-2.5 ${
                      longAttrs.has(attr)
                        ? 'min-w-[160px] max-w-[240px]'
                        : 'min-w-[80px] max-w-[120px]'
                    } ${isLast ? 'border-r border-r-border' : ''}`}
                  >
                    <SectionLabel>{formatAttributeName(attr)}</SectionLabel>
                  </TableHead>
                )
              })}

              {outputs.length > 0 && (
                <TableHead className="border-b border-border whitespace-nowrap min-w-[160px] max-w-[300px] px-3 py-2.5">
                  <SectionLabel>Output</SectionLabel>
                </TableHead>
              )}

              {graders.map((eg) => (
                <TableHead
                  key={eg.graderId}
                  className="text-center border-b border-border whitespace-nowrap min-w-[72px] px-3 py-2.5"
                >
                  <SectionLabel>{eg.grader.name}</SectionLabel>
                  {filteredResults.length > 0 &&
                    (() => {
                      const graderResults = filteredResults.filter(
                        (r) => r.graderId === eg.graderId,
                      )
                      const passes = graderResults.filter((r) => r.verdict === 'pass').length
                      const total = graderResults.length
                      const pct = total > 0 ? Math.round((passes / total) * 100) : 0
                      return (
                        <span className="block font-mono text-[10px] tabular-nums text-muted-foreground/70 mt-0.5">
                          {passes}/{total} — {pct}%
                        </span>
                      )
                    })()}
                </TableHead>
              ))}

              <TableHead className="text-center border-b border-border whitespace-nowrap min-w-[60px] px-3 py-2.5">
                <SectionLabel>Pass</SectionLabel>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={attributes.length + graders.length + 1}
                  className="py-8 text-center text-xs text-muted-foreground/70"
                >
                  No items match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <ResultsTableRow
                  key={item.id}
                  item={item}
                  attributes={attributes}
                  graders={graders}
                  results={results}
                  longAttrs={longAttrs}
                  outputMap={outputMap}
                  hasOutputs={outputs.length > 0}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
