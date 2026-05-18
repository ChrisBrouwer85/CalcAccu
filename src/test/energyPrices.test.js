import { describe, it, expect } from 'vitest'
import {
  getStaticPricesForYear,
  buildHourlyPriceMap,
  hourKey,
  getStaticPriceMap,
  DUTCH_PRICE_HISTORY,
} from '../utils/energyPrices.js'

describe('getStaticPricesForYear', () => {
  it('returns exact year when present', () => {
    const p = getStaticPricesForYear(2024)
    expect(p).toEqual(DUTCH_PRICE_HISTORY[2024])
  })

  it('returns closest year for unknown years', () => {
    const p = getStaticPricesForYear(2018)
    expect(p).toEqual(DUTCH_PRICE_HISTORY[2019])
  })

  it('returns closest year for future years', () => {
    const p = getStaticPricesForYear(2050)
    const maxYear = Math.max(...Object.keys(DUTCH_PRICE_HISTORY).map(Number))
    expect(p).toEqual(DUTCH_PRICE_HISTORY[maxYear])
  })
})

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

describe('getStaticPriceMap', () => {
  it('assigns uniform buy price to all hours', () => {
    const hourlyData = [
      { timestamp: new Date('2024-01-01T01:00:00Z') },
      { timestamp: new Date('2024-01-01T02:00:00Z') },
    ]
    const map = getStaticPriceMap(hourlyData, 0.35)
    for (const row of hourlyData) {
      expect(map.get(hourKey(row.timestamp))).toBe(0.35)
    }
  })
})
