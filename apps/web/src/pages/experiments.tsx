import { useParams } from 'react-router'
import { ExperimentList } from '@/components/experiments/experiment-list'
import { ExperimentDetail } from '@/components/experiments/experiment-detail'

export function ExperimentsPage() {
  const { id } = useParams<{ id: string }>()
  return id ? <ExperimentDetail key={id} id={id} /> : <ExperimentList />
}
