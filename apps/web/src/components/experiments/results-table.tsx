import { useState } from 'react'
import type { Experiment, ExperimentResult } from '@/hooks/use-experiments'
import { VerdictCell } from './verdict-cell'
import { AggregateStats } from './aggregate-stats'

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
      // All graders must have a pass verdict (and result must exist)
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          color: 'var(--fg-muted)',
          fontSize: '13px',
        }}
      >
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

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Aggregate stats — filter-aware, only when results exist */}
      {results.length > 0 && (
        <AggregateStats
          experiment={experiment}
          filteredResults={filteredResults}
          filteredItemCount={filteredItems.length}
        />
      )}

      {/* Filter controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-1)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--fg-muted)',
            marginRight: '4px',
          }}
        >
          Filter
        </span>
        {(['all', 'passed-all', 'any-failed'] as ResultsFilter[]).map((opt) => {
          const labels: Record<ResultsFilter, string> = {
            all: 'All',
            'passed-all': 'Passed All',
            'any-failed': 'Any Failed',
          }
          const isActive = filter === opt
          return (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              style={{
                height: '24px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'var(--bg-surface-3)' : 'transparent',
                color: isActive ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
                border: isActive ? '1px solid var(--border-strong)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 120ms ease-out',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--fg-secondary)'
                  e.currentTarget.style.background = 'var(--bg-surface-2)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--fg-tertiary)'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {labels[opt]}
            </button>
          )
        })}
        {filter !== 'all' && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              marginLeft: '4px',
            }}
          >
            {filteredItems.length}/{items.length}
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'auto',
          }}
        >
          <thead>
            <tr
              style={{ background: 'var(--bg-surface-2)', position: 'sticky', top: 0, zIndex: 10 }}
            >
              {/* Input column header */}
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border-subtle)',
                  borderRight: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--fg-tertiary)',
                  whiteSpace: 'nowrap',
                  minWidth: '200px',
                  maxWidth: '320px',
                }}
              >
                Input
              </th>
              {/* Grader column headers with pass rate */}
              {graders.map((eg) => {
                const gs = graderPassRates.find((g) => g.graderId === eg.graderId)
                return (
                  <th
                    key={eg.graderId}
                    style={{
                      padding: '6px 12px',
                      textAlign: 'center',
                      borderBottom: '1px solid var(--border-subtle)',
                      borderRight: '1px solid var(--border-subtle)',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--fg-tertiary)',
                      whiteSpace: 'nowrap',
                      minWidth: '80px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      <span>{eg.grader.name}</span>
                      {gs && gs.total > 0 && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 400,
                            fontSize: '10px',
                            color: 'var(--fg-tertiary)',
                            textTransform: 'none',
                            letterSpacing: 0,
                          }}
                        >
                          {gs.passes}/{gs.total} — {gs.pct}%
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
              {/* Summary column header */}
              <th
                style={{
                  padding: '6px 12px',
                  textAlign: 'center',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--fg-tertiary)',
                  whiteSpace: 'nowrap',
                  minWidth: '72px',
                }}
              >
                Pass
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={graders.length + 2}
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    color: 'var(--fg-muted)',
                    fontSize: '12px',
                  }}
                >
                  No items match the current filter.
                </td>
              </tr>
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
                  <tr
                    key={item.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-surface-1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {/* Input label cell */}
                    <td
                      style={{
                        padding: '0 12px',
                        borderRight: '1px solid var(--border-subtle)',
                        height: '44px',
                        maxWidth: '320px',
                        minWidth: '200px',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          color: 'var(--fg-secondary)',
                          fontFamily: 'var(--font-mono)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={inputLabel}
                      >
                        {inputLabel}
                      </span>
                    </td>

                    {/* Verdict cells */}
                    {graders.map((eg) => {
                      const result = results.find(
                        (r) => r.datasetRevisionItemId === item.id && r.graderId === eg.graderId,
                      )
                      return (
                        <td
                          key={eg.graderId}
                          style={{
                            padding: 0,
                            borderRight: '1px solid var(--border-subtle)',
                          }}
                        >
                          <VerdictCell
                            verdict={result?.verdict ?? null}
                            reason={result?.reason}
                            itemLabel={inputLabel}
                            graderName={eg.grader.name}
                          />
                        </td>
                      )
                    })}

                    {/* Per-item pass summary */}
                    <td
                      style={{
                        padding: '0 12px',
                        textAlign: 'center',
                        height: '44px',
                      }}
                    >
                      {itemResultCount > 0 ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 500,
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
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--fg-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}

            {/* Aggregate row — pinned at bottom visually (sticky via position) */}
            <tr
              style={{
                background: 'var(--bg-surface-2)',
                borderTop: '1px solid var(--border-default)',
                position: 'sticky',
                bottom: 0,
                zIndex: 10,
              }}
            >
              <td
                style={{
                  padding: '8px 12px',
                  borderRight: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--fg-tertiary)',
                }}
              >
                Pass Rate
              </td>
              {graderPassRates.map((gs) => {
                const rate = gs.rate
                let barColor = 'var(--pass)'
                if (rate !== null && rate < 0.5) barColor = 'var(--fail)'
                else if (rate !== null && rate < 0.8) barColor = 'var(--error)'

                return (
                  <td
                    key={gs.graderId}
                    style={{
                      padding: '6px 12px',
                      borderRight: '1px solid var(--border-subtle)',
                      textAlign: 'center',
                    }}
                  >
                    {rate !== null ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 500,
                            color: barColor,
                          }}
                        >
                          {gs.pct}%
                        </span>
                        <div
                          style={{
                            height: '4px',
                            width: '48px',
                            background: 'var(--bg-surface-3)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${gs.pct ?? 0}%`,
                              background: barColor,
                              borderRadius: '2px',
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--fg-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>
                )
              })}
              {/* Summary aggregate */}
              <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                {(() => {
                  const totalPasses = graderPassRates.reduce((sum, gs) => sum + gs.passes, 0)
                  const totalFilteredCells = filteredItems.length * graders.length
                  const overallPct =
                    totalFilteredCells > 0
                      ? Math.round((totalPasses / totalFilteredCells) * 100)
                      : null
                  return (
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--fg-tertiary)',
                      }}
                    >
                      {totalPasses}/{totalFilteredCells}
                      {overallPct !== null && ` — ${overallPct}%`}
                    </span>
                  )
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
