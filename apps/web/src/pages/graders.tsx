import { useParams } from 'react-router'
import { GraderList } from '@/components/graders/grader-list'
import { GraderDetail } from '@/components/graders/grader-detail'

export function GradersPage() {
  const { id } = useParams<{ id: string }>()
  return id ? <GraderDetail id={id} /> : <GraderList />
}
