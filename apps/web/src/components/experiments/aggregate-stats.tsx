import { Separator } from '@/components/ui/separator'
import type { Experiment, ExperimentResult } from '@/hooks/use-experiments'

interface AggregateStatsProps {
  experiment: Experiment
  filteredResults?: ExperimentResult[]
  filteredItemCount?: number
}

function passRate(results: ExperimentResult[]): number {
  if (results.length === 0) return 0
  return results.filter((r) => r.verdict === 'pass').length / results.length
}

export function AggregateStats({
  experiment,
  filteredResults,
  filteredItemCount,
}: AggregateStatsProps) {
  const allResults = experiment.results ?? []
  const results = filteredResults ?? allResults
  const graders = experiment.graders ?? []
  const items = experiment.dataset?.items ?? []

  const itemCount = filteredItemCount ?? items.length
  const totalCells = itemCount * graders.length
  const overallPassCount = results.filter((r) => r.verdict === 'pass').length
  const overallPct = totalCells > 0 ? Math.round((overallPassCount / totalCells) * 100) : 0
  const overallRate = totalCells > 0 ? overallPassCount / totalCells : 0

  // Determine headline color (dynamic semantic — kept as inline style)
  let headlineColor = 'var(--pass-fg)'
  if (overallRate < 0.5) headlineColor = 'var(--fail-fg)'
  else if (overallRate < 0.8) headlineColor = 'var(--error-fg)'

  // Per-grader pass rates (uses filtered results when provided)
  const graderStats = graders.map((eg) => {
    const graderResults = results.filter((r) => r.graderId === eg.graderId)
    const rate = passRate(graderResults)
    const passes = graderResults.filter((r) => r.verdict === 'pass').length
    return {
      id: eg.graderId,
      name: eg.grader.name,
      rate,
      pct: Math.round(rate * 100),
      passes,
      total: graderResults.length,
    }
  })

  return (
    <div className="bg-card border-b border-border px-6 py-3 flex items-center gap-8 min-h-[80px] flex-shrink-0">
      {/* Overall pass rate */}
      <div className="shrink-0">
        <div
          className="text-2xl font-semibold font-mono tabular-nums leading-none"
          style={{ color: headlineColor }}
        >
          {overallPassCount}/{totalCells} — {overallPct}%
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">
          Pass Rate
        </div>
      </div>

      <Separator orientation="vertical" className="h-10" />

      {/* Cell count */}
      <div className="shrink-0">
        <p className="font-mono text-sm tabular-nums text-muted-foreground">
          {itemCount} items × {graders.length} graders = {totalCells} evals
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {results.length} completed · {totalCells - results.length} pending
        </p>
      </div>

      {/* Per-grader breakdown */}
      {graderStats.length > 0 && (
        <>
          <Separator orientation="vertical" className="h-10" />
          <div className="flex gap-5 flex-1 overflow-hidden">
            {graderStats.map((gs) => {
              let barColor = 'var(--pass)'
              if (gs.rate < 0.5) barColor = 'var(--fail)'
              else if (gs.rate < 0.8) barColor = 'var(--error)'

              return (
                <div key={gs.id} className="min-w-[100px] flex-1 max-w-[180px]">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">
                      {gs.name}
                    </span>
                    <p className="font-mono text-sm tabular-nums text-muted-foreground shrink-0 ml-1">
                      {gs.passes}/{gs.total} — {gs.pct}%
                    </p>
                  </div>
                  {/* Progress bar — dynamic width + color stay inline */}
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${gs.pct}%`, background: barColor }}
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
