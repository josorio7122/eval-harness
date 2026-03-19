import { Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/components/shared/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface PromptHeaderProps {
  name: string
  onNameChange: (value: string) => void
  onNameSave: () => void
  onDeleteClick: () => void
  nameError: string | null
}

export function PromptHeader({
  name,
  onNameChange,
  onNameSave,
  onDeleteClick,
  nameError,
}: PromptHeaderProps) {
  const navigate = useNavigate()

  return (
    <>
      <PageHeader onBack={() => navigate('/prompts')} className="flex-shrink-0">
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onBlur={onNameSave}
          className="text-base font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0 shadow-none flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onDeleteClick}
          className="text-muted-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={12} />
          Delete
        </Button>
      </PageHeader>
      {nameError && <p className="text-destructive text-xs px-6 py-1">{nameError}</p>}
    </>
  )
}
