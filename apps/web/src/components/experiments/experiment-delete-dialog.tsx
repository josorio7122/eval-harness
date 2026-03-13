import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

interface ExperimentDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experimentName: string;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function ExperimentDeleteDialog(props: ExperimentDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Delete "${props.experimentName}"?`}
      description="This action cannot be undone. All results will be permanently deleted."
      onConfirm={props.onConfirm}
      isDeleting={props.isDeleting}
    />
  );
}
