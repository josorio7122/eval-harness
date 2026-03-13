import { Trash2 } from 'lucide-react'
import type { Experiment } from '@/hooks/use-experiments'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DatasetDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  datasetName: string
  affectedExperiments: Experiment[]
  onConfirm: () => Promise<void>
  isDeleting: boolean
}

export default function DatasetDeleteDialog({
  open,
  onOpenChange,
  datasetName,
  affectedExperiments,
  onConfirm,
  isDeleting,
}: DatasetDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete dataset &ldquo;{datasetName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {affectedExperiments.length > 0 ? (
              <span className="flex flex-col gap-2">
                <span className="text-destructive">
                  The following experiments reference this dataset and will also be deleted along
                  with all their evaluation results:
                </span>
                <ul className="bg-destructive/5 border border-destructive/20 rounded-md p-3 mt-2 space-y-1 text-sm list-disc list-inside">
                  {affectedExperiments.map((exp) => (
                    <li key={exp.id} className="text-destructive font-mono text-xs">
                      {exp.name}
                    </li>
                  ))}
                </ul>
              </span>
            ) : (
              'All items, revision history, and any associated experiments with their results will be permanently deleted.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 />
            {isDeleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
