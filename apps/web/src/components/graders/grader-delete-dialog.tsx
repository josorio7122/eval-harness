import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

interface GraderDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  graderName: string;
  affectedExperiments: string[];
  onConfirm: () => void;
  isDeleting: boolean;
}

export function GraderDeleteDialog(props: GraderDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Delete "${props.graderName}"?`}
      description="This action cannot be undone."
      affectedItems={props.affectedExperiments}
      affectedItemsLabel="These experiments will also be deleted:"
      onConfirm={props.onConfirm}
      isDeleting={props.isDeleting}
    />
  );
}
