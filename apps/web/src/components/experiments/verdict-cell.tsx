import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { ExperimentResult } from '@/hooks/use-experiments'

type Verdict = ExperimentResult['verdict'] | null

interface VerdictCellProps {
  verdict: Verdict
  reason?: string
  itemLabel?: string
  graderName?: string
}

const GLYPHS: Record<NonNullable<Verdict>, string> = {
  pass: '✓',
  fail: '✗',
  error: '!',
}

const GLYPH_COLORS: Record<NonNullable<Verdict>, string> = {
  pass: 'var(--pass-fg)',
  fail: 'var(--fail-fg)',
  error: 'var(--error-fg)',
}

const BORDER_COLORS: Record<NonNullable<Verdict>, string> = {
  pass: 'var(--pass)',
  fail: 'var(--fail)',
  error: 'var(--error)',
}

const BG_TINTS: Record<NonNullable<Verdict>, string> = {
  pass: 'transparent',
  fail: 'var(--fail-subtle)',
  error: 'var(--error-subtle)',
}

export function VerdictCell({ verdict, reason, itemLabel, graderName }: VerdictCellProps) {
  const glyph = verdict ? GLYPHS[verdict] : '—'
  const glyphColor = verdict ? GLYPH_COLORS[verdict] : 'var(--neutral-fg)'
  const borderColor = verdict ? BORDER_COLORS[verdict] : 'var(--neutral)'
  const bgTint = verdict ? BG_TINTS[verdict] : 'transparent'

  const hasTooltip = !!(reason || itemLabel || graderName)

  const cell = (
    <div
      style={{
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeft: `2px solid ${borderColor}`,
        background: bgTint,
        padding: '8px 12px',
        width: '100%',
      }}
    >
      <span
        className="font-mono text-sm font-semibold leading-none select-none"
        style={{ color: glyphColor }}
      >
        {glyph}
      </span>
    </div>
  )

  if (!hasTooltip) {
    return <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>{cell}</div>
  }

  return (
    <Tooltip>
      <TooltipTrigger
        style={{ display: 'inline-block', width: '100%' }}
      >
        {cell}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs min-w-[200px] text-left p-3 font-normal">
        <div className="flex flex-col gap-1.5">
          {(graderName || itemLabel) && (
            <div className="flex gap-2 flex-wrap">
              {graderName && (
                <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
                  {graderName}
                </span>
              )}
              {itemLabel && (
                <span className="text-[10px] font-mono opacity-60 truncate max-w-[200px]">
                  {itemLabel}
                </span>
              )}
            </div>
          )}
          {reason && (
            <p className="text-xs font-mono leading-relaxed break-words">{reason}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
