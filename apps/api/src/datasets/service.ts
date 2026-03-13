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

// RFC 4180 compliant CSV value escaping
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// RFC 4180 compliant CSV row parser (handles quoted fields with double-quote escaping)
function parseCsvRow(row: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < row.length) {
    if (row[i] === '"') {
      // Quoted field
      let field = ''
      i++ // skip opening quote
      while (i < row.length) {
        if (row[i] === '"') {
          if (i + 1 < row.length && row[i + 1] === '"') {
            // Escaped double-quote
            field += '"'
            i += 2
          } else {
            // Closing quote
            i++
            break
          }
        } else {
          field += row[i]
          i++
        }
      }
      // Skip comma after field
      if (i < row.length && row[i] === ',') i++
      fields.push(field)
    } else {
      // Unquoted field — read until comma
      const end = row.indexOf(',', i)
      if (end === -1) {
        fields.push(row.slice(i))
        break
      } else {
        fields.push(row.slice(i, end))
        i = end + 1
      }
    }
  }
  // Handle trailing comma (empty last field)
  if (row.endsWith(',')) fields.push('')
  return fields
}

type ParsedCsvRow = {
  validRows: Record<string, string>[]
  skippedRows: { row: number; reason: string }[]
}

function parseCsvContent(
  attributes: string[],
  csv: string,
): Result<ParsedCsvRow> {
  const lines = csv.split('\n').filter((l) => l.trim() !== '')
  if (lines.length < 1) return fail('CSV is empty')

  const headerCols = parseCsvRow(lines[0]).map(h => h.trim().toLowerCase())

  // Distinct error messages for missing vs unknown columns
  const missingCols = attributes.filter((a) => !headerCols.includes(a))
  const unknownCols = headerCols.filter((h) => !attributes.includes(h))
  if (missingCols.length > 0) return fail(`Missing required columns: ${missingCols.join(', ')}`)
  if (unknownCols.length > 0) return fail(`Unknown columns: ${unknownCols.join(', ')}`)

  const dataRows = lines.slice(1)
  if (dataRows.length === 0) return fail('No data rows found in CSV')

  const validRows: Record<string, string>[] = []
  const skippedRows: { row: number; reason: string }[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2 // 1-indexed, header is row 1
    const cells = parseCsvRow(dataRows[i])
    const values: Record<string, string> = {}
    headerCols.forEach((h, idx) => {
      values[h] = cells[idx] ?? ''
    })

    // Validate empty built-ins
    const emptyBuiltIns = BUILT_IN_ATTRIBUTES.filter(
      (attr) => attributes.includes(attr) && values[attr] === '',
    )
    if (emptyBuiltIns.length > 0) {
      skippedRows.push({ row: rowNumber, reason: `Empty required field: ${emptyBuiltIns.join(', ')}` })
      continue
    }

    validRows.push(values)
  }

  return ok({ validRows, skippedRows })
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

    async getCsvTemplate(datasetId: string): Promise<Result<{ csv: string; name: string }>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')
        return ok({ csv: dataset.attributes.join(','), name: dataset.name })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async exportCsv(datasetId: string): Promise<Result<{ csv: string; name: string }>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')

        const items = await repo.findItemsByDatasetId(datasetId)
        const header = dataset.attributes.join(',')
        const rows = items.map((item) =>
          dataset.attributes
            .map((attr) => escapeCsvValue((item.values as Record<string, string>)[attr] ?? ''))
            .join(','),
        )

        return ok({ csv: [header, ...rows].join('\n'), name: dataset.name })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async previewCsv(
      datasetId: string,
      csvContent: string,
    ): Promise<Result<{ validRows: Record<string, string>[]; skippedRows: { row: number; reason: string }[] }>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')

        const parsed = parseCsvContent(dataset.attributes, csvContent)
        if (!parsed.success) return parsed

        return ok(parsed.data)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async importCsv(
      datasetId: string,
      csvContent: string,
    ): Promise<Result<{ imported: number; skipped: number }>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')

        const parsed = parseCsvContent(dataset.attributes, csvContent)
        if (!parsed.success) return parsed

        const { validRows, skippedRows } = parsed.data

        for (const values of validRows) {
          await repo.createItem(datasetId, values)
        }

        return ok({ imported: validRows.length, skipped: skippedRows.length })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },
  }
}
