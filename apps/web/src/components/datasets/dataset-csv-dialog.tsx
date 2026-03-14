import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usePreviewCsv, useImportCsv } from '@/hooks/use-datasets'
import type { CsvPreview } from '@/hooks/use-datasets'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { SectionLabel } from '@/components/shared/section-label'
import { FileDropZone } from '@/components/shared/file-drop-zone'

interface DatasetCsvDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  datasetId: string
  onImportSuccess: () => void
}

export default function DatasetCsvDialog({
  open,
  onOpenChange,
  datasetId,
  onImportSuccess,
}: DatasetCsvDialogProps) {
  const [importFile, setImportFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null)
  const previewCsv = usePreviewCsv()
  const importCsv = useImportCsv()

  function handleClose() {
    onOpenChange(false)
    setCsvPreview(null)
    setImportFile(null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
        </DialogHeader>

        {/* File picker */}
        <FileDropZone
          accept=".csv,text/csv"
          fileName={importFile?.name}
          disabled={importCsv.isPending}
          onFileSelect={async (file) => {
            setImportFile(file)
            setCsvPreview(null)
            try {
              const preview = await previewCsv.mutateAsync({ datasetId, file })
              setCsvPreview(preview)
            } catch {
              // error shown via previewCsv.error
            }
          }}
        />

        {/* Preview loading */}
        {previewCsv.isPending && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading preview…
          </div>
        )}

        {/* Preview error */}
        {previewCsv.isError && (
          <p className="text-destructive text-xs">
            {previewCsv.error instanceof Error ? previewCsv.error.message : 'Preview failed'}
          </p>
        )}

        {/* Preview table */}
        {csvPreview && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">
              Preview — {csvPreview.validRowCount} rows
            </span>

            {csvPreview.skippedRows && csvPreview.skippedRows.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-destructive">
                  {csvPreview.skippedRows.length} row
                  {csvPreview.skippedRows.length > 1 ? 's' : ''} skipped:
                </span>
                {csvPreview.skippedRows.map(({ row, reason }) => (
                  <p
                    key={row}
                    className="text-destructive text-xs font-mono bg-destructive/5 border border-destructive/20 rounded px-2 py-0.5"
                  >
                    Row {row}: {reason}
                  </p>
                ))}
              </div>
            )}

            <div className="overflow-auto max-h-48 border border-border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {csvPreview.headers.map((h) => (
                      <TableHead key={h} className="bg-secondary whitespace-nowrap">
                        <SectionLabel>{h}</SectionLabel>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvPreview.rows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {csvPreview.headers.map((h) => (
                        <TableCell
                          key={h}
                          className="text-xs text-muted-foreground font-mono max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap"
                        >
                          {row[h] ?? ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {csvPreview.validRowCount > 5 && (
              <span className="text-xs text-muted-foreground/70">
                …and {csvPreview.validRowCount - 5} more rows
              </span>
            )}
          </div>
        )}

        {/* Import error */}
        {importCsv.isError && (
          <p className="text-destructive text-xs">
            {importCsv.error instanceof Error ? importCsv.error.message : 'Import failed'}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!importFile) return
              await importCsv.mutateAsync({ datasetId, file: importFile })
              onImportSuccess()
              handleClose()
            }}
            disabled={!csvPreview || importCsv.isPending}
          >
            {importCsv.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Importing…
              </>
            ) : (
              'Confirm Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
