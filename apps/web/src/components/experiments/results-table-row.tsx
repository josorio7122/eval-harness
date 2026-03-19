import { TableRow, TableCell } from '@/components/ui/table'
import { VerdictCell } from './verdict-cell'
import type { ExperimentOutput, ExperimentResult } from '@/hooks/use-experiments'

interface ExperimentGrader {
  graderId: string
  grader: { name: string }
}

interface ResultsTableRowProps {
  item: { id: string; values: Record<string, string> }
  attributes: string[]
  graders: ExperimentGrader[]
  results: ExperimentResult[]
  longAttrs: Set<string>
  outputMap: Map<string, ExperimentOutput>
  hasOutputs: boolean
}

function failCount(itemId: string, results: ExperimentResult[]): number {
  return results.filter(
    (r) => r.datasetRevisionItemId === itemId && (r.verdict === 'fail' || r.verdict === 'error'),
  ).length
}

function passCount(itemId: string, results: ExperimentResult[]): number {
  return results.filter((r) => r.datasetRevisionItemId === itemId && r.verdict === 'pass').length
}

export function ResultsTableRow({
  item,
  attributes,
  graders,
  results,
  longAttrs,
  outputMap,
  hasOutputs,
}: ResultsTableRowProps) {
  const itemPassCount = passCount(item.id, results)
  const itemResultCount = results.filter((r) => r.datasetRevisionItemId === item.id).length
  const allPass = itemPassCount === graders.length && graders.length > 0
  const anyFail = failCount(item.id, results) > 0
  const itemLabel = attributes.length > 0 ? (item.values[attributes[0]] ?? '') : ''

  return (
    <TableRow className="border-b border-border hover:bg-accent">
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

      {hasOutputs && (
        <TableCell className="border-b border-border px-3 py-2 text-xs min-w-[160px] max-w-[300px]">
          {(() => {
            const output = outputMap.get(item.id)
            return (
              <div className="truncate" title={output?.output ?? ''}>
                {output?.error ? (
                  <span className="text-amber-500">Error: {output.error}</span>
                ) : (
                  (output?.output ?? '—')
                )}
              </div>
            )
          })()}
        </TableCell>
      )}

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
}
