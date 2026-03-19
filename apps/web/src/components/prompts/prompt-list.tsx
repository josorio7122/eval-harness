import { useState } from 'react'
import { useNavigate } from 'react-router'
import { MessageSquareText, Plus } from 'lucide-react'
import { usePrompts } from '@/hooks/use-prompts'
import type { Prompt } from '@/hooks/use-prompts'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/data-table'
import type { Column } from '@/components/shared/data-table'
import { CreatePromptDialog } from './create-prompt-dialog'
import { getModelDisplayName } from '@/lib/models'

const columns: Column<Prompt>[] = [
  {
    header: 'Name',
    width: '1fr',
    render: (p) => <span className="font-medium text-foreground">{p.name}</span>,
  },
  {
    header: 'Model',
    width: 'auto',
    render: (p) => (
      <span className="text-muted-foreground">{getModelDisplayName(p.latestVersion.modelId)}</span>
    ),
  },
  {
    header: 'Versions',
    width: 'auto',
    render: (p) => <span className="text-muted-foreground">{p.versionCount}</span>,
  },
  {
    header: 'Last Updated',
    width: 'auto',
    render: (p) => (
      <span className="text-muted-foreground pr-4">
        {new Date(p.latestVersion.createdAt).toLocaleDateString()}
      </span>
    ),
  },
]

export function PromptList() {
  const navigate = useNavigate()
  const { data: prompts, isLoading } = usePrompts()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <>
      <DataTable
        title="Prompts"
        columns={columns}
        data={prompts}
        isLoading={isLoading}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => navigate(`/prompts/${p.id}`)}
        emptyState={{
          icon: MessageSquareText,
          title: 'No prompts yet',
          description: 'Create a prompt to get started',
          action: (
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              Create prompt
            </Button>
          ),
        }}
        headerAction={
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New Prompt
          </Button>
        }
      />
      <CreatePromptDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          if (id) navigate(`/prompts/${id}`)
        }}
      />
    </>
  )
}
