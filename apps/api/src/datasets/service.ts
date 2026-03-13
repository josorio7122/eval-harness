import { Readable } from 'stream'
import csvParser from 'csv-parser'
import { json2csv } from 'json-2-csv'
import { ok, fail, tryCatch, type Result } from '@eval-harness/shared'
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
  if (csvText.includes('\0')) return fail('File could not be parsed as CSV')
  if (/^\s*[{[]/.test(trimmed)) return fail('File could not be parsed as CSV')

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

// Dataset shape returned by findById
type Dataset = {
  id: string
  name: string
  attributes: string[]
  schemaVersion?: number
  items?: unknown[]
}

export function createDatasetService(repo: typeof datasetRepository) {
  return {
    listDatasets: repo.findAll.bind(repo),

    getDataset: repo.findById.bind(repo),

    createDataset(input: { name: string }): Promise<Result<unknown>> {
      return tryCatch(async () => {
        const existing = await repo.findByName(input.name)
        if (existing) return fail('Dataset name already exists')
        return repo.create(input.name)
      })
    },

    updateDataset(id: string, input: { name: string }): Promise<Result<unknown>> {
      return tryCatch(async () => {
        const existing = await repo.findByName(input.name)
        if (existing && existing.id !== id) return fail('Dataset name already exists')
        return repo.update(id, input.name)
      })
    },

    deleteDataset: repo.remove.bind(repo),

    addAttribute(id: string, input: { name: string }): Promise<Result<unknown>> {
      return tryCatch(async () => {
        const result = await repo.findById(id)
        if (!result.success) return result
        const dataset = result.data as Dataset
        if (dataset.attributes.includes(input.name)) return fail('Attribute already exists')
        return repo.addAttribute(id, input.name)
      })
    },

    removeAttribute(id: string, attributeName: string): Promise<Result<unknown>> {
      return tryCatch(async () => {
        const result = await repo.findById(id)
        if (!result.success) return result
        const dataset = result.data as Dataset
        if (BUILT_IN_ATTRIBUTES.includes(attributeName))
          return fail('Cannot remove built-in attribute')
        if (!dataset.attributes.includes(attributeName)) return fail('Attribute not found')
        return repo.removeAttribute(id, attributeName)
      })
    },

    listItems(datasetId: string): Promise<Result<unknown>> {
      return tryCatch(async () => {
        const result = await repo.findById(datasetId)
        if (!result.success) return result
        return repo.findItemsByDatasetId(datasetId)
      })
    },

    createItem(
      datasetId: string,
      input: { values: Record<string, string> },
    ): Promise<Result<unknown>> {
      return tryCatch(async () => {
        const result = await repo.findById(datasetId)
        if (!result.success) return result
        const dataset = result.data as Dataset
        const normalized = normalizeItemValues(dataset.attributes, input.values)
        return repo.createItem(datasetId, normalized)
      })
    },

    updateItem(
      datasetId: string,
      itemId: string,
      input: { values: Record<string, string> },
    ): Promise<Result<unknown>> {
      return tryCatch(async () => {
        const result = await repo.findById(datasetId)
        if (!result.success) return result
        const dataset = result.data as Dataset
        const normalized = normalizeItemValues(dataset.attributes, input.values)
        return repo.updateItem(itemId, normalized)
      })
    },

    deleteItem(datasetId: string, itemId: string): Promise<Result<{ deleted: true }>> {
      return tryCatch(async () => {
        const result = await repo.findById(datasetId)
        if (!result.success) return result
        return repo.removeItem(itemId)
      })
    },

    getCsvTemplate(datasetId: string): Promise<Result<{ csv: string; name: string }>> {
      return tryCatch(async () => {
        const result = await repo.findById(datasetId)
        if (!result.success) return result
        const dataset = result.data as Dataset
        const csv = (await json2csv([], { keys: dataset.attributes })).trimEnd()
        return ok({ csv, name: dataset.name })
      })
    },

    exportCsv(datasetId: string): Promise<Result<{ csv: string; name: string }>> {
      return tryCatch(async () => {
        const datasetResult = await repo.findById(datasetId)
        if (!datasetResult.success) return datasetResult
        const dataset = datasetResult.data as Dataset
        const itemsResult = await repo.findItemsByDatasetId(datasetId)
        if (!itemsResult.success) return itemsResult
        const records = itemsResult.data.map((item) => {
          const values = (item as { values: Record<string, string> }).values
          const row: Record<string, string> = {}
          for (const attr of dataset.attributes) {
            row[attr] = values[attr] ?? ''
          }
          return row
        })
        const csv = (await json2csv(records, { keys: dataset.attributes })).trimEnd()
        return ok({ csv, name: dataset.name })
      })
    },

    previewCsv(
      datasetId: string,
      csvContent: string,
    ): Promise<
      Result<{
        validRows: Record<string, string>[]
        skippedRows: { row: number; reason: string }[]
      }>
    > {
      return tryCatch(async () => {
        const result = await repo.findById(datasetId)
        if (!result.success) return result

        const dataset = result.data as Dataset
        const parsed = await parseCsvContent(dataset.attributes, csvContent)
        if (!parsed.success) return parsed

        return ok(parsed.data)
      })
    },

    importCsv(
      datasetId: string,
      csvContent: string,
    ): Promise<Result<{ imported: number; skipped: number }>> {
      return tryCatch(async () => {
        const result = await repo.findById(datasetId)
        if (!result.success) return result

        const dataset = result.data as Dataset
        const parsed = await parseCsvContent(dataset.attributes, csvContent)
        if (!parsed.success) return parsed

        const { validRows, skippedRows } = parsed.data

        await repo.importItems(datasetId, validRows)

        return ok({ imported: validRows.length, skipped: skippedRows.length })
      })
    },

    listRevisions(datasetId: string): Promise<Result<unknown>> {
      return tryCatch(async () => {
        const result = await repo.findById(datasetId)
        if (!result.success) return result
        return repo.findRevisions(datasetId)
      })
    },

    getRevision(datasetId: string, revisionId: string): Promise<Result<unknown>> {
      return tryCatch(async () => {
        const datasetResult = await repo.findById(datasetId)
        if (!datasetResult.success) return datasetResult
        return repo.findRevisionById(datasetId, revisionId)
      })
    },
  }
}
