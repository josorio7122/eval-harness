import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog'

interface PromptDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promptName: string
  onConfirm: () => void
  isDeleting: boolean
}

export function PromptDeleteDialog(props: PromptDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Delete "${props.promptName}"?`}
      description={`This will hide ${props.promptName} from the list. All versions will be preserved.`}
      onConfirm={props.onConfirm}
      isDeleting={props.isDeleting}
    />
  )
}
