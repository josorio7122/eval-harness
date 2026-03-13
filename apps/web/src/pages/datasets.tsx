import { useParams } from 'react-router'
import { DatasetList } from '@/components/datasets/dataset-list'
import { DatasetDetail } from '@/components/datasets/dataset-detail'

export function DatasetsPage() {
  const { id } = useParams<{ id: string }>()

  return id ? <DatasetDetail id={id} /> : <DatasetList />
}
