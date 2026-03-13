import { ok, fail, type Result } from '@eval-harness/shared'
import { datasetRepository } from './repository.js'

const BUILT_IN_ATTRIBUTES = ['input', 'expected_output']

function validateItemValues(
  attributes: string[],
  values: Record<string, string>,
): Result<void> {
  const attrSet = new Set(attributes)
  const valueKeys = Object.keys(values)

  const missing = attributes.filter((a) => !Object.prototype.hasOwnProperty.call(values, a))
  if (missing.length > 0) {
    return fail(`Missing required keys: ${missing.join(', ')}`)
  }

  const extra = valueKeys.filter((k) => !attrSet.has(k))
  if (extra.length > 0) {
    return fail(`Unknown keys: ${extra.join(', ')}`)
  }

  return ok(undefined)
}

function formatCsvValue(value: string): string {
  if (value.includes(',')) {
    return `"${value}"`
  }
  return value
}

export function createDatasetService(repo: typeof datasetRepository) {
  return {
    async listDatasets(): Promise<Result<Awaited<ReturnType<typeof repo.findAll>>>> {
      try {
        const datasets = await repo.findAll()
        return ok(datasets)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async getDataset(id: string): Promise<Result<NonNullable<Awaited<ReturnType<typeof repo.findById>>>>> {
      try {
        const dataset = await repo.findById(id)
        if (!dataset) return fail('Dataset not found')
        return ok(dataset)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async createDataset(input: { name: string }): Promise<Result<Awaited<ReturnType<typeof repo.create>>>> {
      try {
        const existing = await repo.findByName(input.name)
        if (existing) return fail('Dataset name already exists')
        const created = await repo.create(input.name)
        return ok(created)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async updateDataset(
      id: string,
      input: { name: string },
    ): Promise<Result<Awaited<ReturnType<typeof repo.update>>>> {
      try {
        const dataset = await repo.findById(id)
        if (!dataset) return fail('Dataset not found')

        const existing = await repo.findByName(input.name)
        if (existing && existing.id !== id) return fail('Dataset name already exists')

        const updated = await repo.update(id, input.name)
        return ok(updated)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async deleteDataset(id: string): Promise<Result<{ deleted: true }>> {
      try {
        const dataset = await repo.findById(id)
        if (!dataset) return fail('Dataset not found')
        await repo.remove(id)
        return ok({ deleted: true as const })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async addAttribute(
      id: string,
      input: { name: string },
    ): Promise<Result<Awaited<ReturnType<typeof repo.addAttribute>>>> {
      try {
        const dataset = await repo.findById(id)
        if (!dataset) return fail('Dataset not found')
        if (dataset.attributes.includes(input.name)) return fail('Attribute already exists')
        const updated = await repo.addAttribute(id, input.name)
        return ok(updated)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async removeAttribute(
      id: string,
      attributeName: string,
    ): Promise<Result<Awaited<ReturnType<typeof repo.removeAttribute>>>> {
      try {
        const dataset = await repo.findById(id)
        if (!dataset) return fail('Dataset not found')
        if (BUILT_IN_ATTRIBUTES.includes(attributeName)) return fail('Cannot remove built-in attribute')
        if (!dataset.attributes.includes(attributeName)) return fail('Attribute not found')
        const updated = await repo.removeAttribute(id, attributeName)
        return ok(updated)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async listItems(datasetId: string): Promise<Result<Awaited<ReturnType<typeof repo.findItemsByDatasetId>>>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')
        const items = await repo.findItemsByDatasetId(datasetId)
        return ok(items)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async createItem(
      datasetId: string,
      input: { values: Record<string, string> },
    ): Promise<Result<Awaited<ReturnType<typeof repo.createItem>>>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')

        const validation = validateItemValues(dataset.attributes, input.values)
        if (!validation.success) return validation

        const item = await repo.createItem(datasetId, input.values)
        return ok(item)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async updateItem(
      datasetId: string,
      itemId: string,
      input: { values: Record<string, string> },
    ): Promise<Result<Awaited<ReturnType<typeof repo.updateItem>>>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')

        const item = await repo.findItemById(itemId)
        if (!item) return fail('Item not found')

        const validation = validateItemValues(dataset.attributes, input.values)
        if (!validation.success) return validation

        const updated = await repo.updateItem(itemId, input.values)
        return ok(updated)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async deleteItem(datasetId: string, itemId: string): Promise<Result<{ deleted: true }>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')

        const item = await repo.findItemById(itemId)
        if (!item) return fail('Item not found')

        await repo.removeItem(itemId)
        return ok({ deleted: true as const })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async getCsvTemplate(datasetId: string): Promise<Result<string>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')
        return ok(dataset.attributes.join(','))
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async exportCsv(datasetId: string): Promise<Result<string>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')

        const items = await repo.findItemsByDatasetId(datasetId)
        const header = dataset.attributes.join(',')
        const rows = items.map((item) =>
          dataset.attributes
            .map((attr) => formatCsvValue((item.values as Record<string, string>)[attr] ?? ''))
            .join(','),
        )

        return ok([header, ...rows].join('\n'))
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async importCsv(datasetId: string, csv: string): Promise<Result<{ imported: number }>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')

        const lines = csv.split('\n').filter((l) => l.trim() !== '')
        if (lines.length < 1) return fail('CSV is empty')

        const headers = lines[0].split(',')
        const attrSet = new Set(dataset.attributes)
        const headerSet = new Set(headers)

        // Columns must match attributes exactly
        if (
          headers.length !== dataset.attributes.length ||
          !headers.every((h) => attrSet.has(h)) ||
          !dataset.attributes.every((a) => headerSet.has(a))
        ) {
          return fail('CSV columns do not match dataset attributes')
        }

        const dataRows = lines.slice(1)
        for (const row of dataRows) {
          const cells = row.split(',')
          const values: Record<string, string> = {}
          headers.forEach((h, i) => {
            values[h] = cells[i] ?? ''
          })
          await repo.createItem(datasetId, values)
        }

        return ok({ imported: dataRows.length })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },
  }
}
