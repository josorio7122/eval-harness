import { describe, it, expect } from 'vitest'
import { buildCsvExport } from '../utils.js'
import type { DetailedResult } from '../utils.js'

const attrs = ['input', 'expected_output']

function makeResult(params: {
  itemId: string
  itemValues: Record<string, string>
  graderName: string
  verdict: string
  reason: string
}): DetailedResult {
  return {
    datasetRevisionItemId: params.itemId,
    datasetRevisionItem: { values: params.itemValues },
    grader: { name: params.graderName },
    verdict: params.verdict,
    reason: params.reason,
  }
}

describe('buildCsvExport', () => {
  it('single item, single grader → correct columns and record', () => {
    const results = [
      makeResult({
        itemId: 'item-1',
        itemValues: { input: 'q1', expected_output: 'a1' },
        graderName: 'grader-a',
        verdict: 'pass',
        reason: 'looks good',
      }),
    ]
    const { columns, records } = buildCsvExport(results, attrs)

    expect(columns).toEqual(['input', 'expected_output', 'grader-a_verdict', 'grader-a_reason'])
    expect(records).toHaveLength(1)
    expect(records[0]).toEqual({
      input: 'q1',
      expected_output: 'a1',
      'grader-a_verdict': 'pass',
      'grader-a_reason': 'looks good',
    })
  })

  it('single item, multiple graders → columns interleaved correctly', () => {
    const results = [
      makeResult({
        itemId: 'item-1',
        itemValues: { input: 'q1', expected_output: 'a1' },
        graderName: 'grader-a',
        verdict: 'pass',
        reason: 'great',
      }),
      makeResult({
        itemId: 'item-1',
        itemValues: { input: 'q1', expected_output: 'a1' },
        graderName: 'grader-b',
        verdict: 'fail',
        reason: 'wrong',
      }),
    ]
    const { columns, records } = buildCsvExport(results, attrs)

    expect(columns).toEqual([
      'input',
      'expected_output',
      'grader-a_verdict',
      'grader-a_reason',
      'grader-b_verdict',
      'grader-b_reason',
    ])
    expect(records[0]).toEqual({
      input: 'q1',
      expected_output: 'a1',
      'grader-a_verdict': 'pass',
      'grader-a_reason': 'great',
      'grader-b_verdict': 'fail',
      'grader-b_reason': 'wrong',
    })
  })

  it('multiple items → one record per item', () => {
    const results = [
      makeResult({
        itemId: 'item-1',
        itemValues: { input: 'q1', expected_output: 'a1' },
        graderName: 'grader-a',
        verdict: 'pass',
        reason: 'ok',
      }),
      makeResult({
        itemId: 'item-2',
        itemValues: { input: 'q2', expected_output: 'a2' },
        graderName: 'grader-a',
        verdict: 'fail',
        reason: 'bad',
      }),
    ]
    const { records } = buildCsvExport(results, attrs)

    expect(records).toHaveLength(2)
    expect(records[0].input).toBe('q1')
    expect(records[1].input).toBe('q2')
  })

  it('missing result for a cell → empty verdict and reason', () => {
    // item-2 has no result for grader-b
    const results = [
      makeResult({
        itemId: 'item-1',
        itemValues: { input: 'q1', expected_output: 'a1' },
        graderName: 'grader-a',
        verdict: 'pass',
        reason: 'ok',
      }),
      makeResult({
        itemId: 'item-1',
        itemValues: { input: 'q1', expected_output: 'a1' },
        graderName: 'grader-b',
        verdict: 'pass',
        reason: 'ok',
      }),
      makeResult({
        itemId: 'item-2',
        itemValues: { input: 'q2', expected_output: 'a2' },
        graderName: 'grader-a',
        verdict: 'fail',
        reason: 'bad',
      }),
    ]
    const { records } = buildCsvExport(results, attrs)

    expect(records).toHaveLength(2)
    expect(records[1]['grader-b_verdict']).toBe('')
    expect(records[1]['grader-b_reason']).toBe('')
  })

  it('preserves grader name order of first appearance', () => {
    const results = [
      makeResult({
        itemId: 'item-1',
        itemValues: { input: 'q1', expected_output: 'a1' },
        graderName: 'grader-z',
        verdict: 'pass',
        reason: 'ok',
      }),
      makeResult({
        itemId: 'item-1',
        itemValues: { input: 'q1', expected_output: 'a1' },
        graderName: 'grader-a',
        verdict: 'pass',
        reason: 'ok',
      }),
      makeResult({
        itemId: 'item-1',
        itemValues: { input: 'q1', expected_output: 'a1' },
        graderName: 'grader-m',
        verdict: 'pass',
        reason: 'ok',
      }),
    ]
    const { columns } = buildCsvExport(results, attrs)

    const graderCols = columns.filter((c) => c.endsWith('_verdict') || c.endsWith('_reason'))
    expect(graderCols[0]).toBe('grader-z_verdict')
    expect(graderCols[2]).toBe('grader-a_verdict')
    expect(graderCols[4]).toBe('grader-m_verdict')
  })

  it('preserves item order of first appearance', () => {
    const results = [
      makeResult({
        itemId: 'item-c',
        itemValues: { input: 'qc', expected_output: 'ac' },
        graderName: 'grader-a',
        verdict: 'pass',
        reason: 'ok',
      }),
      makeResult({
        itemId: 'item-a',
        itemValues: { input: 'qa', expected_output: 'aa' },
        graderName: 'grader-a',
        verdict: 'fail',
        reason: 'bad',
      }),
      makeResult({
        itemId: 'item-b',
        itemValues: { input: 'qb', expected_output: 'ab' },
        graderName: 'grader-a',
        verdict: 'pass',
        reason: 'ok',
      }),
    ]
    const { records } = buildCsvExport(results, attrs)

    expect(records[0].input).toBe('qc')
    expect(records[1].input).toBe('qa')
    expect(records[2].input).toBe('qb')
  })
})
