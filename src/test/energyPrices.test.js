import { describe, it, expect } from 'vitest'
import {
  buildHourlyPriceMap,
  hourKey,
} from '../utils/energyPrices.js'

describe('hourKey', () => {
  it('formats a date as YYYY-MM-DDTHH', () => {
    const key = hourKey(new Date('2024-03-15T14:00:00Z'))
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/)
  })

  it('pads single-digit month and day', () => {
    const key = hourKey(new Date('2024-01-05T09:00:00Z'))
    expect(key).toContain('-01-05T')
  })
})

describe('buildHourlyPriceMap', () => {
  it('builds a map keyed by hourKey', () => {
    const ts = new Date('2024-06-01T10:00:00Z')
    const prices = [{ timestamp: ts, price: 0.25 }]
    const map = buildHourlyPriceMap(prices)
    expect(map.get(hourKey(ts))).toBe(0.25)
  })

  it('last entry wins for duplicate hours', () => {
    const ts = new Date('2024-06-01T10:00:00Z')
    const prices = [
      { timestamp: ts, price: 0.20 },
      { timestamp: ts, price: 0.30 },
    ]
    const map = buildHourlyPriceMap(prices)
    expect(map.get(hourKey(ts))).toBe(0.30)
  })
})
