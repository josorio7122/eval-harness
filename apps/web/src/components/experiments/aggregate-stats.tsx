import type { Experiment, ExperimentResult } from '@/hooks/use-experiments'

interface AggregateStatsProps {
  experiment: Experiment
}

function passRate(results: ExperimentResult[]): number {
  if (results.length === 0) return 0
  return results.filter((r) => r.verdict === 'pass').length / results.length
}

export function AggregateStats({ experiment }: AggregateStatsProps) {
  const results = experiment.results ?? []
  const graders = experiment.graders ?? []
  const items = experiment.dataset?.items ?? []

  const totalCells = items.length * graders.length
  const overallRate = passRate(results)
  const overallPct = Math.round(overallRate * 100)

  // Determine headline color
  let headlineColor = 'var(--pass-fg)'
  if (overallRate < 0.5) headlineColor = 'var(--fail-fg)'
  else if (overallRate < 0.8) headlineColor = 'var(--error-fg)'

  // Per-grader pass rates
  const graderStats = graders.map((eg) => {
    const graderResults = results.filter((r) => r.graderId === eg.graderId)
    const rate = passRate(graderResults)
    return {
      id: eg.graderId,
      name: eg.grader.name,
      rate,
      pct: Math.round(rate * 100),
      total: graderResults.length,
    }
  })

  return (
    <div
      style={{
        background: 'var(--bg-surface-1)',
        borderBottom: '1px solid var(--border-default)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
        minHeight: '80px',
        flexShrink: 0,
      }}
    >
      {/* Overall pass rate */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            fontSize: '24px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
            color: headlineColor,
            lineHeight: 1,
          }}
        >
          {overallPct}%
        </div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--fg-tertiary)',
            marginTop: '4px',
          }}
        >
          Pass Rate
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: '1px',
          height: '40px',
          background: 'var(--border-default)',
          flexShrink: 0,
        }}
      />

      {/* Cell count */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--fg-secondary)',
          }}
        >
          {items.length} items × {graders.length} graders = {totalCells} evals
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--fg-tertiary)',
            marginTop: '2px',
          }}
        >
          {results.length} completed · {totalCells - results.length} pending
        </div>
      </div>

      {/* Per-grader breakdown */}
      {graderStats.length > 0 && (
        <>
          <div
            style={{
              width: '1px',
              height: '40px',
              background: 'var(--border-default)',
              flexShrink: 0,
            }}
          />
          <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
            {graderStats.map((gs) => {
              let barColor = 'var(--pass)'
              if (gs.rate < 0.5) barColor = 'var(--fail)'
              else if (gs.rate < 0.8) barColor = 'var(--error)'

              return (
                <div key={gs.id} style={{ minWidth: '100px', flex: '1 1 0', maxWidth: '180px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--fg-tertiary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '110px',
                      }}
                    >
                      {gs.name}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--fg-secondary)',
                        flexShrink: 0,
                        marginLeft: '4px',
                      }}
                    >
                      {gs.pct}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      height: '4px',
                      background: 'var(--bg-surface-2)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${gs.pct}%`,
                        background: barColor,
                        borderRadius: '2px',
                        transition: 'width 300ms ease-out',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
