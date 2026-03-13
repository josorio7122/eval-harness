import { describe, it, expect } from 'vitest'
import { normalizeItemValues, parseCsvContent, BUILT_IN_ATTRIBUTES } from '../utils.js'

describe('BUILT_IN_ATTRIBUTES', () => {
  it('contains input and expected_output', () => {
    expect(BUILT_IN_ATTRIBUTES).toContain('input')
    expect(BUILT_IN_ATTRIBUTES).toContain('expected_output')
  })
})

describe('normalizeItemValues', () => {
  it('fills missing attributes with empty string', () => {
    const result = normalizeItemValues(['input', 'expected_output', 'notes'], { input: 'hello' })
    expect(result).toEqual({ input: 'hello', expected_output: '', notes: '' })
  })

  it('drops keys not in attributes', () => {
    const result = normalizeItemValues(['input'], { input: 'hello', unknown: 'drop me' })
    expect(result).toEqual({ input: 'hello' })
    expect('unknown' in result).toBe(false)
  })

  it('keeps existing values unchanged', () => {
    const result = normalizeItemValues(['input', 'expected_output'], {
      input: 'the question',
      expected_output: 'the answer',
    })
    expect(result).toEqual({ input: 'the question', expected_output: 'the answer' })
  })
})

describe('parseCsvContent', () => {
  const attrs = ['input', 'expected_output']

  it('parses valid CSV with matching headers', async () => {
    const csv = 'input,expected_output\nhello,world\nfoo,bar'
    const result = await parseCsvContent(attrs, csv)
    expect(result.validRows).toEqual([
      { input: 'hello', expected_output: 'world' },
      { input: 'foo', expected_output: 'bar' },
    ])
    expect(result.skippedRows).toEqual([])
  })

  it('throws on empty CSV', async () => {
    await expect(parseCsvContent(attrs, '')).rejects.toThrow('CSV is empty')
  })

  it('throws on whitespace-only CSV', async () => {
    await expect(parseCsvContent(attrs, '   \n  ')).rejects.toThrow('CSV is empty')
  })

  it('throws on JSON content', async () => {
    await expect(parseCsvContent(attrs, '{"key":"value"}')).rejects.toThrow(
      'File could not be parsed as CSV',
    )
  })

  it('throws on JSON array content', async () => {
    await expect(parseCsvContent(attrs, '[1,2,3]')).rejects.toThrow(
      'File could not be parsed as CSV',
    )
  })

  it('throws on binary content (null bytes)', async () => {
    await expect(parseCsvContent(attrs, 'input\0expected_output')).rejects.toThrow(
      'File could not be parsed as CSV',
    )
  })

  it('throws on missing required columns', async () => {
    const csv = 'input\nhello'
    await expect(parseCsvContent(attrs, csv)).rejects.toThrow(
      'Missing required columns: expected_output',
    )
  })

  it('throws on unknown columns', async () => {
    const csv = 'input,expected_output,extra\nhello,world,surprise'
    await expect(parseCsvContent(attrs, csv)).rejects.toThrow('Unknown columns: extra')
  })

  it('throws on header-only CSV (no data rows)', async () => {
    const csv = 'input,expected_output'
    await expect(parseCsvContent(attrs, csv)).rejects.toThrow('No data rows found in CSV')
  })

  it('skips rows with empty built-in fields, returns them in skippedRows', async () => {
    const csv = 'input,expected_output\nhello,world\n,missing-input\ngoodrow,answer'
    const result = await parseCsvContent(attrs, csv)
    expect(result.validRows).toEqual([
      { input: 'hello', expected_output: 'world' },
      { input: 'goodrow', expected_output: 'answer' },
    ])
    expect(result.skippedRows).toEqual([{ row: 3, reason: 'Empty required field: input' }])
  })

  it('handles CRLF line endings', async () => {
    const csv = 'input,expected_output\r\nhello,world\r\nfoo,bar'
    const result = await parseCsvContent(attrs, csv)
    expect(result.validRows).toHaveLength(2)
    expect(result.validRows[0]).toEqual({ input: 'hello', expected_output: 'world' })
  })

  it('handles case-insensitive headers (lowercased)', async () => {
    const csv = 'INPUT,Expected_Output\nhello,world'
    const result = await parseCsvContent(attrs, csv)
    expect(result.validRows).toEqual([{ input: 'hello', expected_output: 'world' }])
  })

  it('handles quoted fields with commas', async () => {
    const csv = 'input,expected_output\n"hello, world","foo, bar"'
    const result = await parseCsvContent(attrs, csv)
    expect(result.validRows).toEqual([{ input: 'hello, world', expected_output: 'foo, bar' }])
  })
})
