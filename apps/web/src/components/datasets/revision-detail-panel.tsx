import { useNavigate } from 'react-router'
import { useRevision } from '@/hooks/use-datasets'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionLabel } from '@/components/shared/section-label'

interface RevisionDetailPanelProps {
  datasetId: string
  revisionId: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">{status}</Badge>
    )
  }
  if (status === 'complete') {
    return (
      <Badge className="text-[10px] bg-[var(--pass)]/10 text-[var(--pass-fg)] border-[var(--pass)]/20">
        {status}
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
        {status}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      {status}
    </Badge>
  )
}

export function RevisionDetailPanel({ datasetId, revisionId }: RevisionDetailPanelProps) {
  const navigate = useNavigate()
  const { data: revision, isLoading } = useRevision(datasetId, revisionId)

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 rounded-md" />
        ))}
      </div>
    )
  }

  if (!revision) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/70 text-xs">
        Revision not found.
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Detail header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2.5 flex-wrap">
        <span className="text-sm font-semibold text-foreground font-mono">
          Revision v{revision.schemaVersion}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(revision.createdAt)}</span>
        {revision.isCurrent && (
          <Badge variant="secondary" className="text-[10px]">
            Current
          </Badge>
        )}
      </div>

      <div className="px-5 py-4 flex flex-col gap-5">
        {/* Attributes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <SectionLabel>Attributes</SectionLabel>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {revision.attributes.map((attr) => (
                <Badge key={attr} variant="outline" className="font-mono text-xs">
                  {attr}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Items table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <div className="flex items-center justify-between">
                <SectionLabel>Items ({revision.items.length})</SectionLabel>
                <span className="text-[10px] text-muted-foreground/70 italic font-normal">Read-only</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revision.items.length === 0 ? (
              <div className="p-5 text-center text-muted-foreground/70 text-xs bg-muted border border-border rounded-md">
                No items in this revision.
              </div>
            ) : (
              <div className="border border-border rounded-md overflow-auto opacity-90">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {revision.attributes.map((attr) => (
                        <TableHead
                          key={attr}
                          className="bg-secondary whitespace-nowrap"
                        >
                          <SectionLabel>{attr}</SectionLabel>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revision.items.map((item) => (
                      <TableRow key={item.id}>
                        {revision.attributes.map((attr) => (
                          <TableCell
                            key={attr}
                            className="text-xs text-muted-foreground font-mono max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap"
                          >
                            {item.values[attr] ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Experiments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <SectionLabel>Experiments ({revision.experiments.length})</SectionLabel>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revision.experiments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No experiments</p>
            ) : (
              <div className="flex flex-col gap-1">
                {revision.experiments.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => navigate(`/experiments/${exp.id}`)}
                    className="w-full text-left px-2.5 py-1.5 bg-card border border-border rounded-sm flex items-center justify-between hover:bg-accent transition-colors"
                  >
                    <span className="text-sm text-foreground font-medium">{exp.name}</span>
                    <StatusBadge status={exp.status} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
