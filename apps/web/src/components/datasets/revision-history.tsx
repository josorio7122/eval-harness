import { useState } from 'react'
import { RevisionListPanel } from './revision-list-panel'
import { RevisionDetailPanel } from './revision-detail-panel'

interface RevisionHistoryProps {
  datasetId: string
}

export function RevisionHistory({ datasetId }: RevisionHistoryProps) {
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | undefined>(undefined)

  return (
    <div className="flex flex-1 overflow-hidden">
      <RevisionListPanel
        datasetId={datasetId}
        selectedRevisionId={selectedRevisionId}
        onSelect={setSelectedRevisionId}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedRevisionId ? (
          <RevisionDetailPanel datasetId={datasetId} revisionId={selectedRevisionId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground/70 text-xs">
            Select a revision to view details
          </div>
        )}
      </div>
    </div>
  )
}
