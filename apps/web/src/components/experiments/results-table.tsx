import type { Experiment, ExperimentResult } from '@/hooks/use-experiments'
import { VerdictCell } from './verdict-cell'

interface ResultsTableProps {
  experiment: Experiment
}

function getInputLabel(values: Record<string, string>): string {
  // Prefer 'input', then 'prompt', then first value
  return (
    values['input'] ??
    values['prompt'] ??
    Object.values(values)[0] ??
    '(no label)'
  )
}

function failCount(itemId: string, results: ExperimentResult[]): number {
  return results.filter(
    (r) => r.datasetItemId === itemId && (r.verdict === 'fail' || r.verdict === 'error'),
  ).length
}

export function ResultsTable({ experiment }: ResultsTableProps) {
  const graders = experiment.graders ?? []
  const items = experiment.dataset?.items ?? []
  const results = experiment.results ?? []

  // Sort items: fail count descending (failures float to top)
  const sortedItems = [...items].sort(
    (a, b) => failCount(b.id, results) - failCount(a.id, results),
  )

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

  // Per-grader pass rates for aggregate row
  const graderPassRates = graders.map((eg) => {
    const graderResults = results.filter((r) => r.graderId === eg.graderId)
    const passes = graderResults.filter((r) => r.verdict === 'pass').length
    const total = graderResults.length
    return {
      graderId: eg.graderId,
      rate: total > 0 ? passes / total : null,
      pct: total > 0 ? Math.round((passes / total) * 100) : null,
    }
  })

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'auto',
        }}
      >
        <thead>
          <tr style={{ background: 'var(--bg-surface-2)', position: 'sticky', top: 0, zIndex: 10 }}>
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
            {/* Grader column headers */}
            {graders.map((eg) => (
              <th
                key={eg.graderId}
                style={{
                  padding: '8px 12px',
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
                {eg.grader.name}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sortedItems.map((item) => {
            const inputLabel = getInputLabel(item.values)
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
                    (r) => r.datasetItemId === item.id && r.graderId === eg.graderId,
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
              </tr>
            )
          })}

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
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
                    <span style={{ fontSize: '12px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                      —
                    </span>
                  )}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
