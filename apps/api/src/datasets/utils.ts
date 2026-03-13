import { Readable } from 'stream'
import csvParser from 'csv-parser'

/** Attributes every dataset has. Cannot be removed. */
export const BUILT_IN_ATTRIBUTES = ['input', 'expected_output']

/** Fills missing attributes with empty strings, drops unknown keys. */
export function normalizeItemValues(
  attributes: string[],
  values: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const attr of attributes) {
    normalized[attr] = Object.prototype.hasOwnProperty.call(values, attr) ? values[attr] : ''
  }
  return normalized
}

/**
 * Parses CSV text against a dataset's attribute schema.
 * Validates headers match exactly, skips rows with empty built-in fields.
 * Throws on structural errors (empty CSV, missing columns, unknown columns).
 */
export async function parseCsvContent(
  attributes: string[],
  csvText: string,
): Promise<{
  validRows: Record<string, string>[]
  skippedRows: { row: number; reason: string }[]
}> {
  // Normalize line endings
  csvText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const trimmed = csvText.trim()
  if (!trimmed) throw new Error('CSV is empty')

  // Detect non-CSV content before parsing
  if (csvText.includes('\0')) throw new Error('File could not be parsed as CSV')
  if (/^\s*[{[]/.test(trimmed)) throw new Error('File could not be parsed as CSV')

  // Parse with csv-parser
  return new Promise((resolve, reject) => {
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
        reject(new Error(`CSV parse error: ${err.message}`))
      })
      .on('end', () => {
        // Validate headers
        const missingCols = attributes.filter((a) => !headers.includes(a))
        const unknownCols = headers.filter((h) => !attributes.includes(h))
        if (missingCols.length > 0) {
          reject(new Error(`Missing required columns: ${missingCols.join(', ')}`))
          return
        }
        if (unknownCols.length > 0) {
          reject(new Error(`Unknown columns: ${unknownCols.join(', ')}`))
          return
        }

        if (rows.length === 0) {
          reject(new Error('No data rows found in CSV'))
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

        resolve({ validRows, skippedRows })
      })
  })
}
