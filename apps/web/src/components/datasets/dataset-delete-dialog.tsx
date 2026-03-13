import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";

interface DatasetDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetName: string;
  affectedExperiments: string[];
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DatasetDeleteDialog(props: DatasetDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Delete "${props.datasetName}"?`}
      description="This action cannot be undone. All revisions and items will be permanently deleted."
      affectedItems={props.affectedExperiments}
      affectedItemsLabel="These experiments will also be deleted:"
      onConfirm={props.onConfirm}
      isDeleting={props.isDeleting}
    />
  );
}
