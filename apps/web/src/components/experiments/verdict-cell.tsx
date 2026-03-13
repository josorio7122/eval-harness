import { useRef, useState } from 'react'
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
  const [popoverVisible, setPopoverVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const glyph = verdict ? GLYPHS[verdict] : '—'
  const glyphColor = verdict ? GLYPH_COLORS[verdict] : 'var(--neutral-fg)'
  const borderColor = verdict ? BORDER_COLORS[verdict] : 'var(--neutral)'
  const bgTint = verdict ? BG_TINTS[verdict] : 'transparent'

  function handleMouseEnter() {
    timerRef.current = setTimeout(() => setPopoverVisible(true), 150)
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPopoverVisible(false)
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Cell */}
      <div
        style={{
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderLeft: `2px solid ${borderColor}`,
          background: bgTint,
          padding: '8px 12px',
          cursor: reason ? 'default' : 'default',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            fontWeight: 600,
            color: glyphColor,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {glyph}
        </span>
      </div>

      {/* Popover */}
      {popoverVisible && (reason || itemLabel || graderName) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '4px',
            zIndex: 50,
            background: 'var(--bg-surface-3)',
            border: '1px solid var(--border-strong)',
            borderRadius: '6px',
            padding: '10px 12px',
            maxWidth: '320px',
            minWidth: '200px',
            pointerEvents: 'none',
          }}
        >
          {(itemLabel || graderName) && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: reason ? '6px' : 0,
                flexWrap: 'wrap',
              }}
            >
              {graderName && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--fg-tertiary)',
                  }}
                >
                  {graderName}
                </span>
              )}
              {itemLabel && (
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--fg-muted)',
                    fontFamily: 'var(--font-mono)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '200px',
                  }}
                >
                  {itemLabel}
                </span>
              )}
            </div>
          )}
          {reason && (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--fg-secondary)',
                fontFamily: 'var(--font-mono)',
                lineHeight: '1.5',
                margin: 0,
                wordBreak: 'break-word',
              }}
            >
              {reason}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
