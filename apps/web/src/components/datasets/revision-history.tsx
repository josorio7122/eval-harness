import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRevisions, useRevision } from '@/hooks/use-datasets'

interface RevisionHistoryProps {
  datasetId: string
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function CurrentBadge() {
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: '999px',
        background: 'var(--pass-subtle)',
        color: 'var(--pass-fg)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      Current
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    complete: { bg: 'var(--pass-subtle)', fg: 'var(--pass-fg)' },
    running: { bg: 'var(--bg-surface-2)', fg: 'var(--accent)' },
    failed: { bg: 'var(--fail-subtle)', fg: 'var(--fail-fg)' },
    queued: { bg: 'var(--bg-surface-2)', fg: 'var(--fg-tertiary)' },
  }
  const colors = colorMap[status] ?? { bg: 'var(--bg-surface-2)', fg: 'var(--fg-tertiary)' }
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 500,
        padding: '1px 5px',
        borderRadius: '4px',
        background: colors.bg,
        color: colors.fg,
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  )
}

function ShimmerRow() {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        className="animate-pulse"
        style={{ height: '12px', width: '60px', borderRadius: '4px', background: 'var(--bg-surface-2)' }}
      />
      <div
        className="animate-pulse"
        style={{ height: '11px', width: '100px', borderRadius: '4px', background: 'var(--bg-surface-2)' }}
      />
    </div>
  )
}

function RevisionDetailPanel({
  datasetId,
  revisionId,
}: {
  datasetId: string
  revisionId: string
}) {
  const navigate = useNavigate()
  const { data: revision, isLoading } = useRevision(datasetId, revisionId)

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px',
          overflowY: 'auto',
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{ height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-2)' }}
          />
        ))}
      </div>
    )
  }

  if (!revision) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg-muted)',
          fontSize: '12px',
        }}
      >
        Revision not found.
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Detail header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--fg-primary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Revision v{revision.schemaVersion}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--fg-tertiary)' }}>
          {formatDate(revision.createdAt)}
        </span>
        {revision.isCurrent && <CurrentBadge />}
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Attributes */}
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-tertiary)',
              marginBottom: '8px',
            }}
          >
            Attributes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {revision.attributes.map((attr) => (
              <span
                key={attr}
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  background: 'var(--bg-surface-2)',
                  color: 'var(--fg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {attr}
              </span>
            ))}
          </div>
        </div>

        {/* Items table */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
              }}
            >
              Items ({revision.items.length})
            </div>
            <span
              style={{
                fontSize: '10px',
                color: 'var(--fg-muted)',
                fontStyle: 'italic',
              }}
            >
              Read-only
            </span>
          </div>

          {revision.items.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--fg-muted)',
                fontSize: '12px',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              No items in this revision.
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'auto',
                opacity: 0.9,
              }}
            >
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)' }}>
                    {revision.attributes.map((attr) => (
                      <th
                        key={attr}
                        style={{
                          padding: '6px 10px',
                          textAlign: 'left',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--fg-tertiary)',
                          borderBottom: '1px solid var(--border-subtle)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {attr}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {revision.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {revision.attributes.map((attr) => (
                        <td
                          key={attr}
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            color: 'var(--fg-secondary)',
                            fontFamily: 'var(--font-mono)',
                            maxWidth: '220px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.values[attr] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Experiments */}
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-tertiary)',
              marginBottom: '8px',
            }}
          >
            Experiments ({revision.experiments.length})
          </div>
          {revision.experiments.length === 0 ? (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--fg-muted)',
                fontStyle: 'italic',
              }}
            >
              No experiments
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {revision.experiments.map((exp) => (
                <button
                  key={exp.id}
                  onClick={() => navigate(`/experiments/${exp.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--bg-surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-1)')}
                >
                  <span style={{ fontSize: '12px', color: 'var(--fg-primary)', fontWeight: 500 }}>
                    {exp.name}
                  </span>
                  <StatusBadge status={exp.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function RevisionHistory({ datasetId }: RevisionHistoryProps) {
  const { data: revisions, isLoading } = useRevisions(datasetId)
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(undefined)

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: revision list (40%) */}
      <div
        style={{
          width: '40%',
          minWidth: '200px',
          borderRight: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* List header */}
        <div
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-tertiary)',
            }}
          >
            History
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading && (
            <>
              <ShimmerRow />
              <ShimmerRow />
              <ShimmerRow />
            </>
          )}

          {!isLoading && (!revisions || revisions.length === 0) && (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--fg-muted)',
                fontSize: '12px',
              }}
            >
              No revision history
            </div>
          )}

          {!isLoading &&
            revisions &&
            revisions.map((rev, idx) => {
              const isSelected = rev.id === selectedRevisionId
              const prevRev = revisions[idx + 1]
              const schemaChanged = !prevRev || prevRev.schemaVersion !== rev.schemaVersion

              return (
                <div
                  key={rev.id}
                  onClick={() => setSelectedRevisionId(rev.id)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    borderLeft: isSelected
                      ? '2px solid var(--accent)'
                      : '2px solid transparent',
                    background: isSelected ? 'var(--bg-surface-2)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-1)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Top row: version + current badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: schemaChanged ? 700 : 400,
                        color: 'var(--fg-primary)',
                      }}
                    >
                      v{rev.schemaVersion}
                    </span>
                    {rev.isCurrent && <CurrentBadge />}
                  </div>

                  {/* Second row: item count + experiment count + time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--fg-secondary)' }}>
                      {rev.itemCount} items
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--fg-tertiary)' }}>
                      {rev.experimentCount} experiment{rev.experimentCount !== 1 ? 's' : ''}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--fg-muted)',
                        marginLeft: 'auto',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {relativeTime(rev.createdAt)}
                    </span>
                  </div>

                  {/* Third row: attributes */}
                  {rev.attributes.length > 0 && (
                    <div
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--fg-tertiary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rev.attributes.join(' · ')}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </div>

      {/* Right: detail panel (60%) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {selectedRevisionId ? (
          <RevisionDetailPanel datasetId={datasetId} revisionId={selectedRevisionId} />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fg-muted)',
              fontSize: '12px',
            }}
          >
            Select a revision to view details
          </div>
        )}
      </div>
    </div>
  )
}
