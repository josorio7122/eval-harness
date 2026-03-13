import { type ReactNode } from 'react'
import { ListSkeleton } from './list-skeleton'
import { EmptyState, type EmptyStateProps } from './empty-state'

export interface Column<T> {
  header: string
  width: string
  render: (item: T) => ReactNode
  headerAlign?: 'left' | 'right'
  cellClassName?: string
}

export interface DataTableProps<T> {
  title: string
  columns: Column<T>[]
  data: T[] | undefined
  isLoading: boolean
  onRowClick: (item: T) => void
  keyExtractor: (item: T) => string
  emptyState: EmptyStateProps
  headerAction?: ReactNode
  renderRowOverlay?: (item: T) => ReactNode
}

export function DataTable<T>({
  title,
  columns,
  data,
  isLoading,
  onRowClick,
  keyExtractor,
  emptyState,
  headerAction,
  renderRowOverlay,
}: DataTableProps<T>) {
  const hasData = data && data.length > 0
  const gridTemplate = columns.map((c) => c.width).join(' ')

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
        {!isLoading && hasData && headerAction}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading && <ListSkeleton rows={3} />}
        {!isLoading && !hasData && <EmptyState {...emptyState} />}
        {!isLoading && hasData && (
          <div className="m-6 rounded-lg border border-border/50 overflow-hidden">
            {/* Column headers */}
            <div
              className="grid px-6 py-2.5 border-b border-border/50 bg-muted"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {columns.map((col) => (
                <span
                  key={col.header}
                  className={`text-[10px] font-semibold uppercase tracking-wider text-muted-foreground${col.headerAlign === 'right' ? ' text-right' : ''}`}
                >
                  {col.header}
                </span>
              ))}
            </div>
            {/* Rows */}
            {data.map((item) => (
              <button
                key={keyExtractor(item)}
                onClick={() => onRowClick(item)}
                className="group relative grid w-full items-center border-b border-border/50 last:border-b-0 text-left transition-colors bg-transparent hover:bg-card cursor-pointer"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {columns.map((col, i) => (
                  <span
                    key={i}
                    className={`px-6 py-3 text-sm truncate${col.cellClassName ? ` ${col.cellClassName}` : ''}`}
                  >
                    {col.render(item)}
                  </span>
                ))}
                {renderRowOverlay?.(item)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
