import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import type { Experiment } from '@/hooks/use-experiments'

interface GraderChartProps {
  experiment: Experiment
}

interface ChartEntry {
  grader: string
  name: string
  passes: number
  total: number
  pct: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartEntry }>
}

const PASS_COLOR = 'hsl(142, 60%, 40%)'

function GraderTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-mono tabular-nums text-foreground">
        {entry.passes}/{entry.total} — {entry.pct}%
      </p>
    </div>
  )
}

export function GraderChart({ experiment }: GraderChartProps) {
  const graders = experiment.graders ?? []
  const results = experiment.results ?? []

  if (graders.length === 0) return null

  const chartData: ChartEntry[] = graders.map((eg) => {
    const graderResults = results.filter((r) => r.graderId === eg.graderId)
    const passes = graderResults.filter((r) => r.verdict === 'pass').length
    const total = graderResults.length
    const pct = total > 0 ? Math.round((passes / total) * 100) : 0
    return { grader: eg.graderId, name: eg.grader.name, passes, total, pct }
  })

  const totalPasses = chartData.reduce((sum, d) => sum + d.passes, 0)
  const totalCells = chartData.reduce((sum, d) => sum + d.total, 0)
  const overallPct = totalCells > 0 ? Math.round((totalPasses / totalCells) * 100) : 0

  const chartConfig = graders.reduce<ChartConfig>((acc, eg) => {
    acc[eg.graderId] = { label: eg.grader.name, color: PASS_COLOR }
    return acc
  }, {})
  chartConfig['pct'] = { label: 'Pass rate', color: PASS_COLOR }

  const chartHeight = graders.length * 40 + 24

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-mono tabular-nums text-muted-foreground">
        {totalPasses}/{totalCells} passed — {overallPct}%
      </p>

      <ChartContainer
        config={chartConfig}
        className="w-full"
        style={{ height: chartHeight, aspectRatio: 'unset' }}
      >
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          barSize={14}
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<GraderTooltip />} cursor={false} />
          <Bar
            dataKey="pct"
            radius={[0, 3, 3, 0]}
            background={{ fill: 'var(--secondary)', radius: 3 }}
          >
            {chartData.map((entry) => (
              <Cell key={entry.grader} fill={PASS_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
