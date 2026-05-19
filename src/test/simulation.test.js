import { describe, it, expect } from 'vitest'
import { runSimulation } from '../utils/simulation.js'
import { getStaticPriceMap } from '../utils/energyPrices.js'

function makeHour(timestamp, solar, gridImport, gridExport) {
  return { timestamp: new Date(timestamp), solar, gridImport, gridExport }
}

const BATTERY_10KWH = {
  capacityKwh: 10,
  chargeEfficiency: 1.0,
  dischargeEfficiency: 1.0,
  maxChargeRateKw: 10,
  maxDischargeRateKw: 10,
}

const STRATEGY_HOME = { homePriority: 1.0 }

function priceMap(hourlyData, price = 0.30) {
  return getStaticPriceMap(hourlyData, price)
}

describe('runSimulation – basic energy balance', () => {
  it('charges battery from solar surplus', () => {
    const data = [
      makeHour('2024-06-01T10:00:00Z', 5, 0, 2), // 5 solar, 0 import, 2 export → homeConsumption = 3, surplus = 2
    ]
    const map = priceMap(data)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(result.hourly[0].batteryCharge).toBeGreaterThan(0)
    expect(result.totals.batteryCharge).toBeGreaterThan(0)
  })

  it('discharges battery when there is a deficit', () => {
    // solar=10, home=3 (gridImport=0, gridExport=7 → homeConsumption=3), surplus=7 → charges battery
    const charged = [makeHour('2024-06-01T10:00:00Z', 10, 0, 7)]
    // solar=0, home=3 (gridImport=3) → deficit=3, battery discharges
    const deficit = [makeHour('2024-06-01T20:00:00Z', 0, 3, 0)]
    const data = [...charged, ...deficit]
    const map = priceMap(data)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(result.hourly[1].batteryDischarge).toBeGreaterThan(0)
    expect(result.hourly[1].gridImport).toBeLessThan(3)
  })

  it('never exceeds battery capacity', () => {
    const data = Array.from({ length: 24 }, (_, i) =>
      makeHour(`2024-06-01T${String(i).padStart(2, '0')}:00:00Z`, 10, 0, 0)
    )
    const map = priceMap(data)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    for (const h of result.hourly) {
      expect(h.batteryLevel).toBeLessThanOrEqual(BATTERY_10KWH.capacityKwh + 0.001)
      expect(h.batteryLevel).toBeGreaterThanOrEqual(-0.001)
    }
  })

  it('produces zero savings without solar or battery contribution', () => {
    const data = [makeHour('2024-01-01T10:00:00Z', 0, 2, 0)]
    const map = priceMap(data)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(result.financial.annualSavings).toBeCloseTo(0)
  })
})

describe('runSimulation – financial', () => {
  it('calculates positive annual savings when battery reduces grid import', () => {
    const data = [
      makeHour('2024-06-01T10:00:00Z', 8, 0, 3), // surplus → charges battery
      makeHour('2024-06-01T20:00:00Z', 0, 5, 0), // deficit → battery discharges
    ]
    const map = priceMap(data, 0.30)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(result.financial.annualSavings).toBeGreaterThan(0)
  })

  it('monthly savings sum matches annual savings', () => {
    const data = Array.from({ length: 48 }, (_, i) =>
      makeHour(
        new Date(Date.UTC(2024, 0, 1, i % 24)).toISOString(),
        i % 24 < 12 ? 5 : 0,
        i % 24 < 12 ? 0 : 3,
        0
      )
    )
    const map = priceMap(data, 0.30)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    const monthlySum = result.monthly.reduce((s, m) => s + m.savings, 0)
    expect(monthlySum).toBeCloseTo(result.financial.annualSavings, 5)
  })
})

describe('runSimulation – self-sufficiency', () => {
  it('self-sufficiency is 0 with no solar and no battery charge', () => {
    const data = [makeHour('2024-01-01T10:00:00Z', 0, 5, 0)]
    const map = priceMap(data)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(result.totals.selfSufficiency).toBe(0)
  })

  it('self-sufficiency improves with battery vs baseline', () => {
    const data = [
      makeHour('2024-06-01T10:00:00Z', 8, 0, 3),
      makeHour('2024-06-01T20:00:00Z', 0, 5, 0),
    ]
    const map = priceMap(data)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(result.totals.selfSufficiency).toBeGreaterThanOrEqual(result.totals.baselineSelfSufficiency)
  })
})

describe('runSimulation – per-sensor tariffs', () => {
  function makeHourWithSensors(timestamp, solar, importMap, exportMap) {
    const gridImport = Object.values(importMap).reduce((s, v) => s + v, 0)
    const gridExport = Object.values(exportMap).reduce((s, v) => s + v, 0)
    return { timestamp: new Date(timestamp), solar, gridImport, gridExport, sensorImport: importMap, sensorExport: exportMap }
  }

  it('uses sensor tariff for import cost: higher tariff increases savings', () => {
    // Hour 1: solar + some export → battery charges from the surplus
    // Hour 2: battery discharges to reduce import from sensor.a
    // With tariff €0.40 (vs priceMap €0.30), savings on reduced import should be higher
    const data = [
      makeHourWithSensors('2024-01-01T10:00:00Z', 8, {}, { 'sensor.export': 3 }), // home=5, surplus=3 → charges
      makeHourWithSensors('2024-01-01T20:00:00Z', 0, { 'sensor.a': 5 }, {}),       // deficit → battery covers
    ]
    const map = priceMap(data, 0.30)
    const tariffs = { 'sensor.a': 0.40 }
    const noTariffResult = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    const tariffResult = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, tariffs)
    // Tariff €0.40 > priceMap €0.30, so battery saves more per kWh with sensor tariff
    expect(tariffResult.financial.annualSavings).toBeGreaterThan(noTariffResult.financial.annualSavings)
  })

  it('uses sensor tariff for baseline export revenue calculation', () => {
    // sensor.b: 2 kWh export at €0.25 → baseline revenue €0.50
    // fallback would give 2 * 0.10 = €0.20
    const data = [
      makeHourWithSensors('2024-01-01T12:00:00Z', 5, {}, { 'sensor.b': 2 }),
    ]
    const map = priceMap(data, 0.30)
    const tariffs = { 'sensor.b': 0.25 }
    const noTariffResult = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    const tariffResult = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, tariffs)
    expect(tariffResult.financial.annualSavings).not.toBeCloseTo(noTariffResult.financial.annualSavings, 2)
  })

  it('falls back to priceMap when no sensorTariffs provided', () => {
    const data = [
      makeHourWithSensors('2024-01-01T10:00:00Z', 0, { 'sensor.a': 3 }, {}),
    ]
    const map = priceMap(data, 0.30)
    const withEmpty = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, {})
    const withNull = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, null)
    const withUndefined = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(withEmpty.financial.annualSavings).toBeCloseTo(withNull.financial.annualSavings, 5)
    expect(withNull.financial.annualSavings).toBeCloseTo(withUndefined.financial.annualSavings, 5)
  })

  it('handles multiple import sensors with different tariffs', () => {
    // Two import sensors with different tariffs
    const data = [
      makeHourWithSensors('2024-01-01T20:00:00Z', 0,
        { 'sensor.cheap': 2, 'sensor.expensive': 2 },
        {}
      ),
    ]
    const map = priceMap(data, 0.30)
    const tariffs = { 'sensor.cheap': 0.10, 'sensor.expensive': 0.50 }
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, tariffs)
    // Should process without errors and have some financial result
    expect(result.financial).toBeDefined()
    expect(result.totals.gridImport).toBeGreaterThanOrEqual(0)
  })
})
