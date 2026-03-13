import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddAttributeDialog } from './add-attribute-dialog'
import { AddItemDialog, EditItemDialog } from './add-item-dialog'
import { useDataset, useRemoveAttribute, useDeleteItem } from '@/hooks/use-datasets'
import type { DatasetItem } from '@/hooks/use-datasets'

interface DatasetDetailProps {
  id: string
}

export function DatasetDetail({ id }: DatasetDetailProps) {
  const navigate = useNavigate()
  const { data: dataset, isLoading } = useDataset(id)
  const removeAttr = useRemoveAttribute()
  const deleteItem = useDeleteItem()
  const [editItem, setEditItem] = useState<DatasetItem | undefined>(undefined)
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div
          className="flex items-center gap-3 px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div
            className="h-4 w-32 animate-pulse rounded"
            style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-sm)' }}
          />
        </div>
        <div className="flex flex-1">
          <div
            className="w-[30%] border-r p-4 flex flex-col gap-2"
            style={{ borderColor: 'var(--border-default)' }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[28px] animate-pulse rounded"
                style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-sm)' }}
              />
            ))}
          </div>
          <div className="flex-1 p-4" />
        </div>
      </div>
    )
  }

  if (!dataset) {
    return (
      <div className="p-6" style={{ color: 'var(--fg-secondary)' }}>
        Dataset not found.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <button
          onClick={() => navigate('/datasets')}
          className="flex items-center gap-1 transition-colors"
          style={{
            color: 'var(--fg-tertiary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--fg-secondary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--fg-tertiary)'
          }}
        >
          <ArrowLeft size={14} />
        </button>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--fg-tertiary)',
          }}
        >
          /
        </span>
        <h2
          style={{ fontSize: '16px', fontWeight: 600, color: 'var(--fg-primary)' }}
        >
          {dataset.name}
        </h2>
      </div>

      {/* Two-panel split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Schema panel (30%) */}
        <div
          className="flex flex-col border-r overflow-hidden"
          style={{
            width: '30%',
            minWidth: '200px',
            maxWidth: '320px',
            borderColor: 'var(--border-default)',
          }}
        >
          {/* Schema header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
              }}
            >
              Schema
            </span>
            <AddAttributeDialog
              datasetId={id}
              trigger={
                <button
                  className="flex items-center gap-1 transition-colors"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--fg-tertiary)',
                    fontSize: '11px',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--fg-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--fg-tertiary)'
                  }}
                >
                  <Plus size={12} />
                  Add
                </button>
              }
            />
          </div>

          {/* Attribute list */}
          <div className="flex-1 overflow-auto">
            {dataset.attributes.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 p-6 text-center"
                style={{ color: 'var(--fg-muted)', fontSize: '12px' }}
              >
                <p>No attributes defined.</p>
                <AddAttributeDialog
                  datasetId={id}
                  trigger={
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--accent)',
                        fontSize: '12px',
                        textDecoration: 'underline',
                      }}
                    >
                      Add the first attribute
                    </button>
                  }
                />
              </div>
            ) : (
              dataset.attributes.map((attr) => (
                <AttributeRow
                  key={attr}
                  name={attr}
                  onDelete={() => removeAttr.mutate({ datasetId: id, name: attr })}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Items table (70%) */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Items header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
              }}
            >
              Items{' '}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ({dataset.items.length})
              </span>
            </span>
            <AddItemDialog
              datasetId={id}
              attributes={dataset.attributes}
              trigger={
                <button
                  className="flex items-center gap-1 transition-colors"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--fg-tertiary)',
                    fontSize: '11px',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--fg-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--fg-tertiary)'
                  }}
                >
                  <Plus size={12} />
                  Add
                </button>
              }
            />
          </div>

          {/* Items table */}
          <div className="flex-1 overflow-auto">
            {dataset.attributes.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-2 p-10 m-6 text-center"
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  minHeight: '160px',
                  color: 'var(--fg-muted)',
                  fontSize: '12px',
                }}
              >
                <p>Add attributes to define the schema before adding items.</p>
              </div>
            ) : dataset.items.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-3 p-10 m-6 text-center"
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  minHeight: '160px',
                }}
              >
                <p style={{ color: 'var(--fg-secondary)', fontSize: '13px', fontWeight: 500 }}>
                  No items yet
                </p>
                <p style={{ color: 'var(--fg-tertiary)', fontSize: '12px' }}>
                  Add items to populate this dataset.
                </p>
                <AddItemDialog
                  datasetId={id}
                  attributes={dataset.attributes}
                  trigger={
                    <Button
                      size="sm"
                      style={{
                        background: 'var(--bg-surface-2)',
                        color: 'var(--fg-primary)',
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      <Plus size={14} />
                      Add Item
                    </Button>
                  }
                />
              </div>
            ) : (
              <table
                className="w-full"
                style={{ borderCollapse: 'collapse' }}
              >
                <thead>
                  <tr style={{ background: 'var(--bg-surface-1)' }}>
                    {dataset.attributes.map((attr) => (
                      <th
                        key={attr}
                        className="px-4 py-2 text-left border-b"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--fg-tertiary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {attr}
                      </th>
                    ))}
                    <th
                      className="px-4 py-2 border-b"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        width: '60px',
                      }}
                    />
                  </tr>
                </thead>
                <tbody>
                  {dataset.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      attributes={dataset.attributes}
                      onEdit={() => {
                        setEditItem(item)
                        setEditOpen(true)
                      }}
                      onDelete={() =>
                        deleteItem.mutate({ datasetId: id, itemId: item.id })
                      }
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Edit item dialog — controlled externally */}
      {editItem && (
        <EditItemDialog
          datasetId={id}
          item={editItem}
          attributes={dataset.attributes}
          open={editOpen}
          onOpenChange={(v) => {
            setEditOpen(v)
            if (!v) setEditItem(undefined)
          }}
        />
      )}
    </div>
  )
}

// ── Attribute Row ──────────────────────────────────────────────────────────────

function AttributeRow({ name, onDelete }: { name: string; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b"
      style={{
        borderColor: 'var(--border-subtle)',
        background: hovered ? 'var(--bg-surface-1)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          fontSize: '12px',
          color: 'var(--fg-secondary)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {name}
      </span>
      {hovered && (
        <button
          onClick={onDelete}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--fg-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: '2px',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--fail-fg)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--fg-muted)'
          }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}

// ── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  attributes,
  onEdit,
  onDelete,
}: {
  item: DatasetItem
  attributes: string[]
  onEdit: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <tr
      style={{ background: hovered ? 'var(--bg-surface-1)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {attributes.map((attr) => (
        <td
          key={attr}
          className="px-4 py-2 border-b"
          style={{
            borderColor: 'var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--fg-secondary)',
            fontFamily: 'var(--font-mono)',
            maxWidth: '280px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.values[attr] ?? ''}
        </td>
      ))}
      <td
        className="px-4 py-2 border-b"
        style={{ borderColor: 'var(--border-subtle)', width: '60px' }}
      >
        {hovered && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fg-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--fg-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--fg-muted)'
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={onDelete}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fg-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--fail-fg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--fg-muted)'
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
