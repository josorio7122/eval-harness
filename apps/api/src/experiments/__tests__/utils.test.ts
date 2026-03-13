import { describe, it, expect } from 'vitest'
import { buildCsvExport } from '../utils.js'
import type { DetailedResult } from '../utils.js'

const attrs = ['input', 'expected_output']

function makeResult(
  itemId: string,
  itemValues: Record<string, string>,
  graderName: string,
  verdict: string,
  reason: string,
): DetailedResult {
  return {
    datasetRevisionItemId: itemId,
    datasetRevisionItem: { values: itemValues },
    grader: { name: graderName },
    verdict,
    reason,
  }
}

describe('buildCsvExport', () => {
  it('single item, single grader → correct columns and record', () => {
    const results = [
      makeResult(
        'item-1',
        { input: 'q1', expected_output: 'a1' },
        'grader-a',
        'pass',
        'looks good',
      ),
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
      makeResult('item-1', { input: 'q1', expected_output: 'a1' }, 'grader-a', 'pass', 'great'),
      makeResult('item-1', { input: 'q1', expected_output: 'a1' }, 'grader-b', 'fail', 'wrong'),
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
      makeResult('item-1', { input: 'q1', expected_output: 'a1' }, 'grader-a', 'pass', 'ok'),
      makeResult('item-2', { input: 'q2', expected_output: 'a2' }, 'grader-a', 'fail', 'bad'),
    ]
    const { records } = buildCsvExport(results, attrs)

    expect(records).toHaveLength(2)
    expect(records[0].input).toBe('q1')
    expect(records[1].input).toBe('q2')
  })

  it('missing result for a cell → empty verdict and reason', () => {
    // item-2 has no result for grader-b
    const results = [
      makeResult('item-1', { input: 'q1', expected_output: 'a1' }, 'grader-a', 'pass', 'ok'),
      makeResult('item-1', { input: 'q1', expected_output: 'a1' }, 'grader-b', 'pass', 'ok'),
      makeResult('item-2', { input: 'q2', expected_output: 'a2' }, 'grader-a', 'fail', 'bad'),
    ]
    const { records } = buildCsvExport(results, attrs)

    expect(records).toHaveLength(2)
    expect(records[1]['grader-b_verdict']).toBe('')
    expect(records[1]['grader-b_reason']).toBe('')
  })

  it('preserves grader name order of first appearance', () => {
    const results = [
      makeResult('item-1', { input: 'q1', expected_output: 'a1' }, 'grader-z', 'pass', 'ok'),
      makeResult('item-1', { input: 'q1', expected_output: 'a1' }, 'grader-a', 'pass', 'ok'),
      makeResult('item-1', { input: 'q1', expected_output: 'a1' }, 'grader-m', 'pass', 'ok'),
    ]
    const { columns } = buildCsvExport(results, attrs)

    const graderCols = columns.filter((c) => c.endsWith('_verdict') || c.endsWith('_reason'))
    expect(graderCols[0]).toBe('grader-z_verdict')
    expect(graderCols[2]).toBe('grader-a_verdict')
    expect(graderCols[4]).toBe('grader-m_verdict')
  })

  it('preserves item order of first appearance', () => {
    const results = [
      makeResult('item-c', { input: 'qc', expected_output: 'ac' }, 'grader-a', 'pass', 'ok'),
      makeResult('item-a', { input: 'qa', expected_output: 'aa' }, 'grader-a', 'fail', 'bad'),
      makeResult('item-b', { input: 'qb', expected_output: 'ab' }, 'grader-a', 'pass', 'ok'),
    ]
    const { records } = buildCsvExport(results, attrs)

    expect(records[0].input).toBe('qc')
    expect(records[1].input).toBe('qa')
    expect(records[2].input).toBe('qb')
  })
})
