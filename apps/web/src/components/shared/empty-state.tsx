import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 m-6 p-10 rounded-lg border border-border/50 bg-muted min-h-[200px]">
      <Icon size={28} className="text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/70">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
