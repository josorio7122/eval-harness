export type DetailedResult = {
  datasetRevisionItemId: string
  datasetRevisionItem: { values: Record<string, string> }
  grader: { name: string }
  verdict: string
  reason: string
}

/**
 * Transforms experiment results into CSV-ready records.
 * Groups results by dataset item, with columns: [...attributes, ...grader_verdict, ...grader_reason].
 * Returns { columns, records } ready for json2csv.
 */
export function buildCsvExport(
  results: DetailedResult[],
  attributes: string[],
): { columns: string[]; records: Record<string, string>[] } {
  // Collect unique grader names (preserving order of first appearance)
  const graderNames: string[] = []
  const graderNameSet = new Set<string>()
  for (const r of results) {
    if (!graderNameSet.has(r.grader.name)) {
      graderNameSet.add(r.grader.name)
      graderNames.push(r.grader.name)
    }
  }

  // Collect unique dataset items (preserving order of first appearance)
  const itemIds: string[] = []
  const itemIdSet = new Set<string>()
  const itemValues = new Map<string, Record<string, string>>()
  for (const r of results) {
    if (!itemIdSet.has(r.datasetRevisionItemId)) {
      itemIdSet.add(r.datasetRevisionItemId)
      itemIds.push(r.datasetRevisionItemId)
      itemValues.set(r.datasetRevisionItemId, r.datasetRevisionItem.values)
    }
  }

  // Index results by (itemId, graderName)
  const resultIndex = new Map<string, { verdict: string; reason: string }>()
  for (const r of results) {
    resultIndex.set(`${r.datasetRevisionItemId}::${r.grader.name}`, {
      verdict: r.verdict,
      reason: r.reason,
    })
  }

  // Build column list
  const graderCols = graderNames.flatMap((g) => [`${g}_verdict`, `${g}_reason`])
  const columns = [...attributes, ...graderCols]

  // Build records
  const records = itemIds.map((itemId) => {
    const values = itemValues.get(itemId) ?? {}
    const row: Record<string, string> = {}
    for (const attr of attributes) {
      row[attr] = values[attr] ?? ''
    }
    for (const graderName of graderNames) {
      const r = resultIndex.get(`${itemId}::${graderName}`)
      row[`${graderName}_verdict`] = r?.verdict ?? ''
      row[`${graderName}_reason`] = r?.reason ?? ''
    }
    return row
  })

  return { columns, records }
}
