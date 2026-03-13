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

interface ExperimentDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  experimentName: string
  onConfirm: () => void
  isDeleting: boolean
}

export function ExperimentDeleteDialog({
  open,
  onOpenChange,
  experimentName,
  onConfirm,
  isDeleting,
}: ExperimentDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete experiment &ldquo;{experimentName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this experiment and all its results.
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
