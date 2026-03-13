import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SectionLabel } from './section-label'

interface PageHeaderProps {
  onBack: () => void
  children: React.ReactNode
  className?: string
}

export function PageHeader({ onBack, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3 border-b border-border px-6 py-4', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-muted-foreground h-7 w-7 p-0"
      >
        <ArrowLeft size={14} />
      </Button>
      <SectionLabel>/</SectionLabel>
      {children}
    </div>
  )
}
