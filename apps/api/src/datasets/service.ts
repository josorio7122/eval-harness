import { Readable } from 'stream'
import csvParser from 'csv-parser'
import { json2csv } from 'json-2-csv'
import { ok, fail, type Result } from '@eval-harness/shared'
import { datasetRepository } from './repository.js'

const BUILT_IN_ATTRIBUTES = ['input', 'expected_output']

function normalizeItemValues(
  attributes: string[],
  values: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const attr of attributes) {
    normalized[attr] = Object.prototype.hasOwnProperty.call(values, attr) ? values[attr] : ''
  }
  return normalized
}

type ParsedCsvRow = {
  validRows: Record<string, string>[]
  skippedRows: { row: number; reason: string }[]
}

async function parseCsvContent(
  attributes: string[],
  csvText: string,
): Promise<Result<ParsedCsvRow>> {
  // Normalize line endings
  csvText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const trimmed = csvText.trim()
  if (!trimmed) return fail('CSV is empty')

  // Detect non-CSV content before parsing
  if (/\x00/.test(csvText)) return fail('File could not be parsed as CSV')
  if (/^\s*[{\[]/.test(trimmed)) return fail('File could not be parsed as CSV')

  // Parse with csv-parser
  return new Promise((resolve) => {
    const rows: Record<string, string>[] = []
    let headers: string[] = []

    Readable.from([csvText])
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => header.trim().toLowerCase(),
        }),
      )
      .on('headers', (headerRow: string[]) => {
        headers = headerRow
      })
      .on('data', (row: Record<string, string>) => {
        rows.push(row)
      })
      .on('error', (err: Error) => {
        resolve(fail(`CSV parse error: ${err.message}`))
      })
      .on('end', () => {
        // Validate headers
        const missingCols = attributes.filter((a) => !headers.includes(a))
        const unknownCols = headers.filter((h) => !attributes.includes(h))
        if (missingCols.length > 0) {
          resolve(fail(`Missing required columns: ${missingCols.join(', ')}`))
          return
        }
        if (unknownCols.length > 0) {
          resolve(fail(`Unknown columns: ${unknownCols.join(', ')}`))
          return
        }

        if (rows.length === 0) {
          resolve(fail('No data rows found in CSV'))
          return
        }

        // Validate rows — skip those with empty built-in fields
        const validRows: Record<string, string>[] = []
        const skippedRows: { row: number; reason: string }[] = []

        for (let i = 0; i < rows.length; i++) {
          const rowNumber = i + 2 // header is row 1
          const values = rows[i]

          const emptyBuiltIns = BUILT_IN_ATTRIBUTES.filter(
            (attr) => attributes.includes(attr) && (values[attr] ?? '') === '',
          )
          if (emptyBuiltIns.length > 0) {
            skippedRows.push({
              row: rowNumber,
              reason: `Empty required field: ${emptyBuiltIns.join(', ')}`,
            })
            continue
          }

          // Only keep attributes that exist in the schema
          const filtered: Record<string, string> = {}
          for (const attr of attributes) {
            filtered[attr] = values[attr] ?? ''
          }
          validRows.push(filtered)
        }

        resolve(ok({ validRows, skippedRows }))
      })
  })
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

        const normalized = normalizeItemValues(dataset.attributes, input.values)

        const item = await repo.createItem(datasetId, normalized)
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

        const normalized = normalizeItemValues(dataset.attributes, input.values)

        const updated = await repo.updateItem(itemId, normalized)
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
        const csv = (await json2csv([], { keys: dataset.attributes })).trimEnd()
        return ok({ csv, name: dataset.name })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async exportCsv(datasetId: string): Promise<Result<{ csv: string; name: string }>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')
        const items = await repo.findItemsByDatasetId(datasetId)
        const records = items.map((item) => {
          const values = item.values as Record<string, string>
          const row: Record<string, string> = {}
          for (const attr of dataset.attributes) {
            row[attr] = values[attr] ?? ''
          }
          return row
        })
        const csv = (await json2csv(records, { keys: dataset.attributes })).trimEnd()
        return ok({ csv, name: dataset.name })
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

        const parsed = await parseCsvContent(dataset.attributes, csvContent)
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

        const parsed = await parseCsvContent(dataset.attributes, csvContent)
        if (!parsed.success) return parsed

        const { validRows, skippedRows } = parsed.data

        await repo.importItems(datasetId, validRows)

        return ok({ imported: validRows.length, skipped: skippedRows.length })
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async listRevisions(datasetId: string): Promise<Result<Awaited<ReturnType<typeof repo.findRevisions>>>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')
        const revisions = await repo.findRevisions(datasetId)
        return ok(revisions)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },

    async getRevision(datasetId: string, revisionId: string): Promise<Result<NonNullable<Awaited<ReturnType<typeof repo.findRevisionById>>>>> {
      try {
        const dataset = await repo.findById(datasetId)
        if (!dataset) return fail('Dataset not found')
        const revision = await repo.findRevisionById(datasetId, revisionId)
        if (!revision) return fail('Revision not found')
        return ok(revision)
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Unknown error')
      }
    },
  }
}
