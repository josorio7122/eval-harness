import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import type { Experiment, ExperimentResult } from '@/hooks/use-experiments'
import { VerdictCell } from './verdict-cell'
import { SectionLabel } from '@/components/shared/section-label'

type ResultsFilter = 'all' | 'passed-all' | 'any-failed'

interface ResultsTableProps {
  experiment: Experiment
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

function passCount(itemId: string, results: ExperimentResult[]): number {
  return results.filter((r) => r.datasetRevisionItemId === itemId && r.verdict === 'pass').length
}

export function ResultsTable({ experiment }: ResultsTableProps) {
  const [filter, setFilter] = useState<ResultsFilter>('all')

  const graders = experiment.graders ?? []
  const items = experiment.revision?.items ?? []
  const results = experiment.results ?? []
  const attributes = experiment.revision?.attributes ?? []

  // Sort items: fail count descending (failures float to top)
  const sortedItems = [...items].sort((a, b) => failCount(b.id, results) - failCount(a.id, results))

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

  const filterLabels: Record<ResultsFilter, string> = {
    all: 'All',
    'passed-all': 'Passed All',
    'any-failed': 'Any Failed',
  }

  return (
    <div className="flex-1 overflow-auto relative flex flex-col">
      {/* Filter controls */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <SectionLabel className="mr-1">Filter</SectionLabel>
        {(['all', 'passed-all', 'any-failed'] as ResultsFilter[]).map((opt) => {
          const isActive = filter === opt
          return (
            <Button
              key={opt}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(opt)}
              className="h-6 px-2 text-[11px]"
            >
              {filterLabels[opt]}
            </Button>
          )
        })}
        {filter !== 'all' && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums ml-1">
            {filteredItems.length}/{items.length}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto relative">
        <Table className="border-collapse" style={{ tableLayout: 'auto' }}>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-card">
              {/* Attribute column headers */}
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

              {/* Grader column headers */}
              {graders.map((eg) => (
                <TableHead
                  key={eg.graderId}
                  className="text-center border-b border-border whitespace-nowrap min-w-[72px] px-3 py-2.5"
                >
                  <SectionLabel>{eg.grader.name}</SectionLabel>
                </TableHead>
              ))}

              {/* Summary column header */}
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
              filteredItems.map((item) => {
                const itemPassCount = passCount(item.id, results)
                const itemResultCount = results.filter(
                  (r) => r.datasetRevisionItemId === item.id,
                ).length
                const allPass = itemPassCount === graders.length && graders.length > 0
                const anyFail = failCount(item.id, results) > 0
                // Use first attribute value as label for tooltip context
                const itemLabel = attributes.length > 0 ? (item.values[attributes[0]] ?? '') : ''

                return (
                  <TableRow key={item.id} className="border-b border-border hover:bg-accent">
                    {/* Attribute cells */}
                    {attributes.map((attr, idx) => {
                      const isLast = idx === attributes.length - 1
                      const value = item.values[attr] ?? ''
                      const isLong = longAttrs.has(attr)
                      return (
                        <TableCell
                          key={attr}
                          className={`text-xs text-muted-foreground px-3 py-2 font-normal ${
                            isLong ? 'max-w-[240px]' : 'max-w-[120px]'
                          } ${isLast ? 'border-r border-border' : ''}`}
                        >
                          <span className="block truncate" title={value}>
                            {value}
                          </span>
                        </TableCell>
                      )
                    })}

                    {/* Verdict cells */}
                    {graders.map((eg) => {
                      const result = results.find(
                        (r) => r.datasetRevisionItemId === item.id && r.graderId === eg.graderId,
                      )
                      return (
                        <TableCell key={eg.graderId} className="p-0">
                          <VerdictCell
                            verdict={result?.verdict ?? null}
                            reason={result?.reason}
                            itemLabel={itemLabel}
                            graderName={eg.grader.name}
                          />
                        </TableCell>
                      )
                    })}

                    {/* Per-item pass summary */}
                    <TableCell className="text-center px-3 py-2">
                      {itemResultCount > 0 ? (
                        <span
                          className="text-[11px] font-mono tabular-nums font-medium"
                          style={{
                            color: allPass
                              ? 'var(--pass-fg)'
                              : anyFail
                                ? 'var(--fail-fg)'
                                : 'var(--fg-secondary)',
                          }}
                        >
                          {itemPassCount}/{graders.length}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-muted-foreground/70">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
