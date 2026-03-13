import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import type { Experiment, ExperimentResult } from '@/hooks/use-experiments'
import { VerdictCell } from './verdict-cell'
import { AggregateStats } from './aggregate-stats'
import { SectionLabel } from '@/components/shared/section-label'

type ResultsFilter = 'all' | 'passed-all' | 'any-failed'

interface ResultsTableProps {
  experiment: Experiment
}

function getInputLabel(values: Record<string, string>): string {
  // Prefer 'input', then 'prompt', then first value
  return values['input'] ?? values['prompt'] ?? Object.values(values)[0] ?? '(no label)'
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
  const items = experiment.dataset?.items ?? []
  const results = experiment.results ?? []

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

  // Per-grader pass rates scoped to currently filtered items
  const filteredItemIds = new Set(filteredItems.map((i) => i.id))
  const graderPassRates = graders.map((eg) => {
    const graderResults = results.filter(
      (r) => r.graderId === eg.graderId && filteredItemIds.has(r.datasetRevisionItemId),
    )
    const passes = graderResults.filter((r) => r.verdict === 'pass').length
    const total = graderResults.length
    return {
      graderId: eg.graderId,
      passes,
      total,
      rate: total > 0 ? passes / total : null,
      pct: total > 0 ? Math.round((passes / total) * 100) : null,
    }
  })

  // Filtered results for AggregateStats
  const filteredResults = results.filter((r) => filteredItemIds.has(r.datasetRevisionItemId))

  const filterLabels: Record<ResultsFilter, string> = {
    all: 'All',
    'passed-all': 'Passed All',
    'any-failed': 'Any Failed',
  }

  return (
    <div className="flex-1 overflow-auto relative flex flex-col">
      {/* Aggregate stats — filter-aware, only when results exist */}
      {results.length > 0 && (
        <AggregateStats
          experiment={experiment}
          filteredResults={filteredResults}
          filteredItemCount={filteredItems.length}
        />
      )}

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
              {/* Input column header */}
              <TableHead className="border-b border-border border-r border-r-border whitespace-nowrap min-w-[200px] max-w-[320px] px-4 py-2.5">
                <SectionLabel>Input</SectionLabel>
              </TableHead>
              {/* Grader column headers with pass rate */}
              {graders.map((eg) => {
                const gs = graderPassRates.find((g) => g.graderId === eg.graderId)
                return (
                  <TableHead
                    key={eg.graderId}
                    className="text-center border-b border-border border-r border-r-border whitespace-nowrap min-w-[80px] px-4 py-2.5"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <SectionLabel>{eg.grader.name}</SectionLabel>
                      {gs && gs.total > 0 && (
                        <span className="font-mono tabular-nums font-normal text-[10px] text-muted-foreground normal-case tracking-normal">
                          {gs.passes}/{gs.total} — {gs.pct}%
                        </span>
                      )}
                    </div>
                  </TableHead>
                )
              })}
              {/* Summary column header */}
              <TableHead className="text-center border-b border-border whitespace-nowrap min-w-[72px] px-4 py-2.5">
                <SectionLabel>Pass</SectionLabel>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={graders.length + 2}
                  className="py-8 text-center text-xs text-muted-foreground/70"
                >
                  No items match the current filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const inputLabel = getInputLabel(item.values)
                const itemPassCount = passCount(item.id, results)
                const itemResultCount = results.filter(
                  (r) => r.datasetRevisionItemId === item.id,
                ).length
                const allPass = itemPassCount === graders.length && graders.length > 0
                const anyFail = failCount(item.id, results) > 0

                return (
                  <TableRow key={item.id} className="border-b border-border hover:bg-accent">
                    {/* Input label cell */}
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px] min-w-[200px] border-r border-border px-4 py-2.5">
                      <span
                        className="block truncate"
                        title={inputLabel}
                      >
                        {inputLabel}
                      </span>
                    </TableCell>

                    {/* Verdict cells */}
                    {graders.map((eg) => {
                      const result = results.find(
                        (r) =>
                          r.datasetRevisionItemId === item.id && r.graderId === eg.graderId,
                      )
                      return (
                        <TableCell key={eg.graderId} className="p-0 border-r border-border">
                          <VerdictCell
                            verdict={result?.verdict ?? null}
                            reason={result?.reason}
                            itemLabel={inputLabel}
                            graderName={eg.grader.name}
                          />
                        </TableCell>
                      )
                    })}

                    {/* Per-item pass summary */}
                    <TableCell className="text-center px-4 py-2.5">
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

            {/* Aggregate footer row — sticky at bottom */}
            <TableRow className="bg-card border-t border-border sticky bottom-0 z-10 hover:bg-card">
              <TableCell className="px-4 py-2.5 border-r border-border">
                <SectionLabel>Pass Rate</SectionLabel>
              </TableCell>
              {graderPassRates.map((gs) => {
                const rate = gs.rate
                let barColor = 'var(--pass)'
                if (rate !== null && rate < 0.5) barColor = 'var(--fail)'
                else if (rate !== null && rate < 0.8) barColor = 'var(--error)'

                return (
                  <TableCell
                    key={gs.graderId}
                    className="px-4 py-2.5 border-r border-border text-center"
                  >
                    {rate !== null ? (
                      <div className="flex flex-col gap-1 items-center">
                        <span
                          className="text-xs font-mono tabular-nums font-medium"
                          style={{ color: barColor }}
                        >
                          {gs.pct}%
                        </span>
                        <div className="h-1 w-12 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${gs.pct ?? 0}%`, background: barColor }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground/70">—</span>
                    )}
                  </TableCell>
                )
              })}
              {/* Summary aggregate */}
              <TableCell className="px-4 py-2.5 text-center">
                {(() => {
                  const totalPasses = graderPassRates.reduce((sum, gs) => sum + gs.passes, 0)
                  const totalFilteredCells = filteredItems.length * graders.length
                  const overallPct =
                    totalFilteredCells > 0
                      ? Math.round((totalPasses / totalFilteredCells) * 100)
                      : null
                  return (
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                      {totalPasses}/{totalFilteredCells}
                      {overallPct !== null && ` — ${overallPct}%`}
                    </span>
                  )
                })()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
