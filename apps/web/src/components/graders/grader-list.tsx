import { useState } from 'react'
import { useNavigate } from 'react-router'
import { GraduationCap, Plus } from 'lucide-react'
import { useGraders } from '@/hooks/use-graders'
import type { Grader } from '@/hooks/use-graders'
import { Button } from '@/components/ui/button'
import { CreateGraderDialog } from './create-grader-dialog'
import { DataTable } from '@/components/shared/data-table'
import type { Column } from '@/components/shared/data-table'

const columns: Column<Grader>[] = [
  {
    header: 'Name',
    width: '1fr',
    render: (g) => (
      <span className="font-medium text-foreground">{g.name}</span>
    ),
  },
  {
    header: 'Description',
    width: '1fr',
    render: (g) => (
      <span className="text-muted-foreground pr-4">{g.description || '—'}</span>
    ),
  },
]

export function GraderList() {
  const navigate = useNavigate()
  const { data: graders, isLoading } = useGraders()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <>
      <DataTable
        title="Graders"
        columns={columns}
        data={graders}
        isLoading={isLoading}
        keyExtractor={(g) => g.id}
        onRowClick={(g) => navigate(`/graders/${g.id}`)}
        emptyState={{
          icon: GraduationCap,
          title: 'No graders yet',
          description: 'Define a rubric to start evaluating',
          action: (
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              Create grader
            </Button>
          ),
        }}
        headerAction={
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New Grader
          </Button>
        }
      />
      <CreateGraderDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          if (id) navigate(`/graders/${id}`)
        }}
      />
    </>
  )
}
