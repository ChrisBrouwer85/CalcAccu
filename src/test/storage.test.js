import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadHaUrl, saveHaUrl,
  loadHaMapping, saveHaMapping,
  loadHourlyData, saveHourlyData,
  serializePriceConfig, deserializePriceConfig,
  serializeSimResults,
  loadSavedSimulations, saveSimulation, deleteSavedSimulation,
  generateSimName,
} from '../utils/storage.js'

beforeEach(() => localStorage.clear())

// ── HA URL ────────────────────────────────────────────────────────────────────

describe('HA URL', () => {
  it('round-trips a URL', () => {
    saveHaUrl('http://192.168.1.100:8123')
    expect(loadHaUrl()).toBe('http://192.168.1.100:8123')
  })

  it('returns null when nothing stored', () => {
    expect(loadHaUrl()).toBeNull()
  })

  it('does not throw on QuotaExceededError', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => saveHaUrl('http://ha.local')).not.toThrow()
    spy.mockRestore()
  })
})

// ── HA sensor mapping ─────────────────────────────────────────────────────────

describe('HA mapping', () => {
  const mapping = {
    solar: 'sensor.solar',
    gridImport: [{ id: 'sensor.import', tariff: 0.29 }],
    gridExport: [{ id: 'sensor.export', tariff: 0.10 }],
  }

  it('round-trips a mapping', () => {
    saveHaMapping(mapping)
    expect(loadHaMapping()).toEqual(mapping)
  })

  it('returns null when nothing stored', () => {
    expect(loadHaMapping()).toBeNull()
  })

  it('returns null on corrupted JSON', () => {
    localStorage.setItem('calcaccu:haMapping', 'bad-json')
    expect(loadHaMapping()).toBeNull()
  })

  it('does not throw on QuotaExceededError', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => saveHaMapping(mapping)).not.toThrow()
    spy.mockRestore()
  })
})

// ── hourlyData ────────────────────────────────────────────────────────────────

describe('hourlyData', () => {
  const rows = [
    { timestamp: new Date('2024-03-01T10:00:00Z'), solar: 1.5, gridImport: 0.2, gridExport: 0.8 },
    { timestamp: new Date('2024-03-01T11:00:00Z'), solar: 2.1, gridImport: 0.0, gridExport: 1.2 },
  ]

  it('restores timestamps as Date instances', () => {
    saveHourlyData(rows)
    const loaded = loadHourlyData()
    expect(loaded[0].timestamp).toBeInstanceOf(Date)
    expect(loaded[1].timestamp).toBeInstanceOf(Date)
  })

  it('preserves timestamp values', () => {
    saveHourlyData(rows)
    const loaded = loadHourlyData()
    expect(loaded[0].timestamp.getTime()).toBe(rows[0].timestamp.getTime())
  })

  it('preserves numeric fields exactly', () => {
    saveHourlyData(rows)
    const loaded = loadHourlyData()
    expect(loaded[0].solar).toBe(1.5)
    expect(loaded[0].gridImport).toBe(0.2)
    expect(loaded[1].gridExport).toBe(1.2)
  })

  it('returns null when absent', () => {
    expect(loadHourlyData()).toBeNull()
  })

  it('returns null on corrupted JSON', () => {
    localStorage.setItem('calcaccu:hourlyData', 'not-json')
    expect(loadHourlyData()).toBeNull()
  })
})

// ── priceConfig serialization ─────────────────────────────────────────────────

describe('serializePriceConfig / deserializePriceConfig', () => {
  it('serializes Map to plain object', () => {
    const cfg = { source: 'api', hourlyPriceMap: new Map([['2024-01-01T10', 0.28], ['2024-01-01T11', 0.30]]) }
    const serialized = serializePriceConfig(cfg)
    expect(serialized.hourlyPriceMap).not.toBeInstanceOf(Map)
    expect(typeof serialized.hourlyPriceMap).toBe('object')
    expect(serialized.hourlyPriceMap['2024-01-01T10']).toBe(0.28)
  })

  it('passes null hourlyPriceMap through', () => {
    const cfg = { source: 'static', hourlyPriceMap: null }
    expect(serializePriceConfig(cfg).hourlyPriceMap).toBeNull()
  })

  it('deserializes plain object to Map', () => {
    const raw = { source: 'api', hourlyPriceMap: { '2024-01-01T10': 0.28 } }
    const result = deserializePriceConfig(raw)
    expect(result.hourlyPriceMap).toBeInstanceOf(Map)
    expect(result.hourlyPriceMap.get('2024-01-01T10')).toBe(0.28)
  })

  it('returns null hourlyPriceMap when raw is null', () => {
    const raw = { source: 'static', hourlyPriceMap: null }
    expect(deserializePriceConfig(raw).hourlyPriceMap).toBeNull()
  })

  it('round-trips Map correctly', () => {
    const original = new Map([['2024-06-01T14', 0.32], ['2024-06-01T15', 0.29]])
    const cfg = { source: 'api', buyPrice: 0.29, sellPrice: 0.09, hourlyPriceMap: original }
    const roundTripped = deserializePriceConfig(serializePriceConfig(cfg))
    expect(roundTripped.hourlyPriceMap.get('2024-06-01T14')).toBe(0.32)
    expect(roundTripped.hourlyPriceMap.size).toBe(2)
  })
})

// ── serializeSimResults ───────────────────────────────────────────────────────

describe('serializeSimResults', () => {
  const results = [
    {
      sizeKwh: 5,
      result: {
        hourly: [{ timestamp: new Date(), solar: 1 }],
        monthly: [{ monthIdx: 0, savings: 10 }],
        totals: { selfSufficiency: 0.5 },
        financial: { annualSavings: 400 },
      },
    },
  ]

  it('strips hourly arrays', () => {
    const serialized = serializeSimResults(results)
    expect(serialized[0].result.hourly).toBeUndefined()
  })

  it('preserves monthly, totals, financial', () => {
    const serialized = serializeSimResults(results)
    expect(serialized[0].result.monthly).toEqual(results[0].result.monthly)
    expect(serialized[0].result.totals).toEqual(results[0].result.totals)
    expect(serialized[0].result.financial).toEqual(results[0].result.financial)
  })

  it('does not mutate original', () => {
    serializeSimResults(results)
    expect(results[0].result.hourly).toBeDefined()
  })
})

// ── saveSimulation / loadSavedSimulations ─────────────────────────────────────

describe('saveSimulation / loadSavedSimulations', () => {
  function makeSim(offset = 0) {
    return {
      id: String(Date.now() + offset),
      name: generateSimName(new Date(2026, 4, 18, 14, 30 + offset)),
      savedAt: new Date(2026, 4, 18, 14, 30 + offset).toISOString(),
      accuConfig: { selectedSizes: [5], customSize: '', efficiency: 0.95, maxRateKw: 5, costPerKwh: 500 },
      priceConfig: { source: 'static', hourlyPriceMap: null },
      homePriority: 0.8,
      simulationResults: [{ sizeKwh: 5, result: { monthly: [], totals: {}, financial: { annualSavings: 400 } } }],
    }
  }

  it('round-trips a saved simulation', () => {
    const sim = makeSim()
    saveSimulation(sim)
    const loaded = loadSavedSimulations()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(sim.id)
  })

  it('returns the updated array from saveSimulation', () => {
    const sim = makeSim()
    const returned = saveSimulation(sim)
    expect(Array.isArray(returned)).toBe(true)
    expect(returned[0].id).toBe(sim.id)
  })

  it('caps at 10 sims (drops oldest)', () => {
    for (let i = 0; i < 11; i++) saveSimulation(makeSim(i * 1000))
    const loaded = loadSavedSimulations()
    expect(loaded).toHaveLength(10)
  })

  it('keeps newest when trimming', () => {
    const sims = []
    for (let i = 0; i < 11; i++) {
      const s = makeSim(i * 1000)
      sims.push(s)
      saveSimulation(s)
    }
    const loaded = loadSavedSimulations()
    const loadedIds = new Set(loaded.map(s => s.id))
    expect(loadedIds.has(sims[0].id)).toBe(false) // oldest dropped
    expect(loadedIds.has(sims[10].id)).toBe(true) // newest kept
  })

  it('returns [] when nothing stored', () => {
    expect(loadSavedSimulations()).toEqual([])
  })

  it('returns [] on corrupted JSON', () => {
    localStorage.setItem('calcaccu:savedSimulations', 'bad')
    expect(loadSavedSimulations()).toEqual([])
  })
})

// ── deleteSavedSimulation ─────────────────────────────────────────────────────

describe('deleteSavedSimulation', () => {
  function makeSim(id) {
    return {
      id,
      name: '2026-05-18 14:30',
      savedAt: new Date().toISOString(),
      accuConfig: { selectedSizes: [5], customSize: '', efficiency: 0.95, maxRateKw: 5, costPerKwh: 500 },
      priceConfig: { source: 'static', hourlyPriceMap: null },
      homePriority: 0.8,
      simulationResults: [],
    }
  }

  it('removes the sim with matching id', () => {
    saveSimulation(makeSim('a'))
    saveSimulation(makeSim('b'))
    const updated = deleteSavedSimulation('a')
    expect(updated.map(s => s.id)).not.toContain('a')
    expect(updated.map(s => s.id)).toContain('b')
  })

  it('returns [] when deleting the only sim', () => {
    saveSimulation(makeSim('only'))
    expect(deleteSavedSimulation('only')).toEqual([])
  })

  it('does not throw when id is not found', () => {
    saveSimulation(makeSim('x'))
    expect(() => deleteSavedSimulation('nonexistent')).not.toThrow()
  })
})

// ── generateSimName ───────────────────────────────────────────────────────────

describe('generateSimName', () => {
  it('formats date as YYYY-MM-DD HH:MM', () => {
    const d = new Date(2026, 4, 18, 14, 5)
    expect(generateSimName(d)).toBe('2026-05-18 14:05')
  })

  it('pads single-digit month/day/hour/minute', () => {
    const d = new Date(2026, 0, 3, 9, 7)
    expect(generateSimName(d)).toBe('2026-01-03 09:07')
  })
})
