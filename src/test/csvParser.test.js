import { describe, it, expect } from 'vitest'
import { detectColumnMapping, parseCSV, applyMapping } from '../utils/csvParser.js'

describe('detectColumnMapping', () => {
  it('maps solar sensor by keyword', () => {
    const m = detectColumnMapping(['sensor.solar_yield', 'sensor.grid_in', 'sensor.grid_out'])
    expect(m.solar).toBe('sensor.solar_yield')
  })

  it('maps grid import and export sensors', () => {
    const m = detectColumnMapping(['sensor.grid_import', 'sensor.grid_export'])
    expect(m.gridImport).toBe('sensor.grid_import')
    expect(m.gridExport).toBe('sensor.grid_export')
  })

  it('returns empty strings when no match', () => {
    const m = detectColumnMapping(['sensor.temperature', 'sensor.humidity'])
    expect(m.solar).toBe('')
    expect(m.gridImport).toBe('')
    expect(m.gridExport).toBe('')
  })

  it('matches Dutch keywords (afname/teruglevering)', () => {
    const m = detectColumnMapping(['sensor.afname', 'sensor.teruglevering'])
    expect(m.gridImport).toBe('sensor.afname')
    expect(m.gridExport).toBe('sensor.teruglevering')
  })
})

describe('parseCSV', () => {
  const rows = [
    { statistic_id: 'sensor.solar', start: '2024-01-01T01:00:00Z', sum: '1.5' },
    { statistic_id: 'sensor.solar', start: '2024-01-01T02:00:00Z', sum: '2.5' },
    { statistic_id: 'sensor.import', start: '2024-01-01T01:00:00Z', sum: '0.8' },
  ]

  it('groups rows by statistic_id', () => {
    const { byId } = parseCSV(rows)
    expect(Object.keys(byId)).toContain('sensor.solar')
    expect(Object.keys(byId)).toContain('sensor.import')
    expect(byId['sensor.solar']).toHaveLength(2)
  })

  it('returns sorted sensorIds', () => {
    const { sensorIds } = parseCSV(rows)
    expect(sensorIds).toEqual([...sensorIds].sort())
  })

  it('skips rows without an id column', () => {
    const { byId } = parseCSV([{ start: '2024-01-01T01:00:00Z', sum: '1' }])
    expect(Object.keys(byId)).toHaveLength(0)
  })

  it('provides suggestedMapping from detected keywords', () => {
    const { suggestedMapping } = parseCSV(rows)
    expect(suggestedMapping.solar).toBe('sensor.solar')
    expect(suggestedMapping.gridImport).toBe('sensor.import')
  })
})

describe('applyMapping', () => {
  const byId = {
    'sensor.solar': [
      { statistic_id: 'sensor.solar', start: '2024-06-01T01:00:00Z', sum: '10' },
      { statistic_id: 'sensor.solar', start: '2024-06-01T02:00:00Z', sum: '13' },
      { statistic_id: 'sensor.solar', start: '2024-06-01T03:00:00Z', sum: '15' },
    ],
    'sensor.import': [
      { statistic_id: 'sensor.import', start: '2024-06-01T01:00:00Z', sum: '5' },
      { statistic_id: 'sensor.import', start: '2024-06-01T02:00:00Z', sum: '6' },
      { statistic_id: 'sensor.import', start: '2024-06-01T03:00:00Z', sum: '8' },
    ],
  }

  it('computes delta values from cumulative sums (legacy string format)', () => {
    const hourly = applyMapping(byId, { solar: 'sensor.solar', gridImport: 'sensor.import', gridExport: '' })
    // First delta: 13-10=3, 15-13=2
    expect(hourly[0].solar).toBeCloseTo(3)
    expect(hourly[1].solar).toBeCloseTo(2)
    expect(hourly[0].gridImport).toBeCloseTo(1)
    expect(hourly[1].gridImport).toBeCloseTo(2)
  })

  it('computes delta values from cumulative sums (array format)', () => {
    const hourly = applyMapping(byId, { solar: 'sensor.solar', gridImport: ['sensor.import'], gridExport: [] })
    expect(hourly[0].gridImport).toBeCloseTo(1)
    expect(hourly[1].gridImport).toBeCloseTo(2)
  })

  it('fills missing solar with 0 when not mapped', () => {
    const hourly = applyMapping(byId, { solar: '', gridImport: 'sensor.import', gridExport: '' })
    expect(hourly[0].solar).toBe(0)
  })

  it('clamps negative deltas to 0 (meter reset)', () => {
    const byIdWithReset = {
      'sensor.import': [
        { statistic_id: 'sensor.import', start: '2024-06-01T01:00:00Z', sum: '100' },
        { statistic_id: 'sensor.import', start: '2024-06-01T02:00:00Z', sum: '10' },
        { statistic_id: 'sensor.import', start: '2024-06-01T03:00:00Z', sum: '15' },
      ],
    }
    const hourly = applyMapping(byIdWithReset, { solar: '', gridImport: 'sensor.import', gridExport: '' })
    expect(hourly[0].gridImport).toBe(0)
    expect(hourly[1].gridImport).toBeCloseTo(5)
  })

  it('returns empty array when no reference rows exist', () => {
    const hourly = applyMapping({}, { solar: '', gridImport: '', gridExport: '' })
    expect(hourly).toHaveLength(0)
  })

  it('includes sensorImport and sensorExport per-sensor breakdown', () => {
    const hourly = applyMapping(byId, {
      solar: 'sensor.solar',
      gridImport: ['sensor.import'],
      gridExport: [],
    })
    expect(hourly[0].sensorImport).toBeDefined()
    expect(hourly[0].sensorImport['sensor.import']).toBeCloseTo(1)
    expect(hourly[0].sensorExport).toBeDefined()
  })

  it('aggregates multiple import sensors into gridImport', () => {
    const multiById = {
      ...byId,
      'sensor.import2': [
        { statistic_id: 'sensor.import2', start: '2024-06-01T01:00:00Z', sum: '0' },
        { statistic_id: 'sensor.import2', start: '2024-06-01T02:00:00Z', sum: '2' },
        { statistic_id: 'sensor.import2', start: '2024-06-01T03:00:00Z', sum: '3' },
      ],
    }
    const hourly = applyMapping(multiById, {
      solar: '',
      gridImport: ['sensor.import', 'sensor.import2'],
      gridExport: [],
    })
    // Hour 0: import1=1, import2=2 → total=3
    expect(hourly[0].gridImport).toBeCloseTo(3)
    expect(hourly[0].sensorImport['sensor.import']).toBeCloseTo(1)
    expect(hourly[0].sensorImport['sensor.import2']).toBeCloseTo(2)
    // Hour 1: import1=2, import2=1 → total=3
    expect(hourly[1].gridImport).toBeCloseTo(3)
  })
})
