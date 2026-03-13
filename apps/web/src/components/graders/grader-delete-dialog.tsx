import { Trash2 } from 'lucide-react'
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

interface GraderDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  graderName: string
  affectedExperiments: string[]
  onConfirm: () => void
  isDeleting: boolean
}

export function GraderDeleteDialog({
  open,
  onOpenChange,
  graderName,
  affectedExperiments,
  onConfirm,
  isDeleting,
}: GraderDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete grader &ldquo;{graderName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {affectedExperiments.length > 0 ? (
              <span className="flex flex-col gap-2">
                <span className="text-destructive">
                  The following experiments use this grader and will also be permanently deleted
                  along with all their evaluation results:
                </span>
                <ul className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1 list-disc list-inside">
                  {affectedExperiments.map((name) => (
                    <li key={name} className="text-destructive font-mono text-xs">
                      {name}
                    </li>
                  ))}
                </ul>
              </span>
            ) : (
              'This action cannot be undone.'
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
