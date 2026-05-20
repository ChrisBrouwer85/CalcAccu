import { describe, it, expect } from 'vitest'
import { runSimulation } from '../utils/simulation.js'
import { hourKey } from '../utils/energyPrices.js'

function makeHour(timestamp, solar, gridImport, gridExport) {
  return { timestamp: new Date(timestamp), solar, gridImport, gridExport }
}

// Build a flat price map where every hour has the same price
function flatPriceMap(hourlyData, price = 0.30) {
  const map = new Map()
  for (const row of hourlyData) {
    map.set(hourKey(row.timestamp), price)
  }
  return map
}

// Build a price map from explicit {timestamp, price} entries
function buildMap(entries) {
  const map = new Map()
  for (const { timestamp, price } of entries) {
    map.set(hourKey(new Date(timestamp)), price)
  }
  return map
}

const BATTERY_10KWH = {
  capacityKwh: 10,
  chargeEfficiency: 1.0,
  dischargeEfficiency: 1.0,
  maxChargeRateKw: 10,
  maxDischargeRateKw: 10,
}

// sellFraction=0: never sells — always maximizes self-consumption
const STRATEGY_HOME = { sellFraction: 0.0, allowGridCharge: false }

describe('runSimulation – basic energy balance', () => {
  it('charges battery from solar surplus', () => {
    const data = [
      makeHour('2024-06-01T10:00:00Z', 5, 0, 2), // 5 solar, 0 import, 2 export → homeConsumption = 3, surplus = 2
    ]
    const map = flatPriceMap(data)
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
    const map = flatPriceMap(data)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(result.hourly[1].batteryDischarge).toBeGreaterThan(0)
    expect(result.hourly[1].gridImport).toBeLessThan(3)
  })

  it('never exceeds battery capacity', () => {
    const data = Array.from({ length: 24 }, (_, i) =>
      makeHour(`2024-06-01T${String(i).padStart(2, '0')}:00:00Z`, 10, 0, 0)
    )
    const map = flatPriceMap(data)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    for (const h of result.hourly) {
      expect(h.batteryLevel).toBeLessThanOrEqual(BATTERY_10KWH.capacityKwh + 0.001)
      expect(h.batteryLevel).toBeGreaterThanOrEqual(-0.001)
    }
  })

  it('produces zero savings without solar or battery contribution', () => {
    const data = [makeHour('2024-01-01T10:00:00Z', 0, 2, 0)]
    const map = flatPriceMap(data)
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
    const map = flatPriceMap(data, 0.30)
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
    const map = flatPriceMap(data, 0.30)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    const monthlySum = result.monthly.reduce((s, m) => s + m.savings, 0)
    expect(monthlySum).toBeCloseTo(result.financial.annualSavings, 5)
  })
})

describe('runSimulation – self-sufficiency', () => {
  it('self-sufficiency is 0 with no solar and no battery charge', () => {
    const data = [makeHour('2024-01-01T10:00:00Z', 0, 5, 0)]
    const map = flatPriceMap(data)
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(result.totals.selfSufficiency).toBe(0)
  })

  it('self-sufficiency improves with battery vs baseline', () => {
    const data = [
      makeHour('2024-06-01T10:00:00Z', 8, 0, 3),
      makeHour('2024-06-01T20:00:00Z', 0, 5, 0),
    ]
    const map = flatPriceMap(data)
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
    const data = [
      makeHourWithSensors('2024-01-01T10:00:00Z', 8, {}, { 'sensor.export': 3 }),
      makeHourWithSensors('2024-01-01T20:00:00Z', 0, { 'sensor.a': 5 }, {}),
    ]
    const map = flatPriceMap(data, 0.30)
    const tariffs = { 'sensor.a': 0.40 }
    const noTariffResult = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    const tariffResult = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, tariffs)
    expect(tariffResult.financial.annualSavings).toBeGreaterThan(noTariffResult.financial.annualSavings)
  })

  it('uses sensor tariff for baseline export revenue calculation', () => {
    const data = [
      makeHourWithSensors('2024-01-01T12:00:00Z', 5, {}, { 'sensor.b': 2 }),
    ]
    const map = flatPriceMap(data, 0.30)
    const tariffs = { 'sensor.b': 0.25 }
    const noTariffResult = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    const tariffResult = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, tariffs)
    expect(tariffResult.financial.annualSavings).not.toBeCloseTo(noTariffResult.financial.annualSavings, 2)
  })

  it('falls back to priceMap when no sensorTariffs provided', () => {
    const data = [
      makeHourWithSensors('2024-01-01T10:00:00Z', 0, { 'sensor.a': 3 }, {}),
    ]
    const map = flatPriceMap(data, 0.30)
    const withEmpty = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, {})
    const withNull = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, null)
    const withUndefined = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10)
    expect(withEmpty.financial.annualSavings).toBeCloseTo(withNull.financial.annualSavings, 5)
    expect(withNull.financial.annualSavings).toBeCloseTo(withUndefined.financial.annualSavings, 5)
  })

  it('handles multiple import sensors with different tariffs', () => {
    const data = [
      makeHourWithSensors('2024-01-01T20:00:00Z', 0,
        { 'sensor.cheap': 2, 'sensor.expensive': 2 },
        {}
      ),
    ]
    const map = flatPriceMap(data, 0.30)
    const tariffs = { 'sensor.cheap': 0.10, 'sensor.expensive': 0.50 }
    const result = runSimulation(data, BATTERY_10KWH, STRATEGY_HOME, map, 0.10, tariffs)
    expect(result.financial).toBeDefined()
    expect(result.totals.gridImport).toBeGreaterThanOrEqual(0)
  })
})

describe('runSimulation – smart EMS', () => {
  // Helper: makeHour with explicit surplus/deficit.
  // homeConsumption = solar + gridImport - gridExport, so:
  //   surplus S kWh: solar=S, gridImport=0, gridExport=S  (home=0, net=S)
  //   deficit D kWh: solar=0, gridImport=D, gridExport=0  (home=D, net=-D)
  //   empty hour:    solar=0, gridImport=0, gridExport=0  (home=0, net=0)
  function surplus(ts, kwh) { return makeHour(ts, kwh, 0, kwh) }
  function deficit(ts, kwh) { return makeHour(ts, 0, kwh, 0) }
  function empty(ts)        { return makeHour(ts, 0, 0, 0) }

  const SMART_50  = { sellFraction: 0.5 }
  const SMART_100 = { sellFraction: 1.0 }
  const SMART_0   = { sellFraction: 0.0 }

  const CHEAP = '2024-06-01T00:00:00Z'
  const PEAK  = '2024-06-01T12:00:00Z'

  function twoHourMap(cheapPrice = 0.10, peakPrice = 0.50) {
    return buildMap([
      { timestamp: CHEAP, price: cheapPrice },
      { timestamp: PEAK,  price: peakPrice  },
    ])
  }

  it('peak hour with surplus: skips battery charge, exports to grid including battery', () => {
    // Cheap: charge 5 kWh into battery; Peak: solar surplus again → export solar + sell battery
    const data = [surplus(CHEAP, 5), surplus(PEAK, 5)]
    const map = twoHourMap()
    const result = runSimulation(data, BATTERY_10KWH, SMART_100, map, 0.10)
    // Peak hour: no charging, exports solar (5) + battery (5) = 10
    expect(result.hourly[1].batteryCharge).toBe(0)
    expect(result.hourly[1].gridExport).toBeGreaterThanOrEqual(5)
    expect(result.hourly[1].batteryDischarge).toBeGreaterThan(0)
  })

  it('peak hour with surplus sells battery above reserve only', () => {
    // Cheap: charge battery to full (10 kWh); Peak: surplus + sellFraction=0.5 → reserve=5
    const data = [surplus(CHEAP, 10), surplus(PEAK, 3)]
    const map = twoHourMap()
    const result = runSimulation(data, BATTERY_10KWH, SMART_50, map, 0.10)
    // sellable = 10 - reserve(5) = 5; exports: 3 solar + 5 battery = 8
    expect(result.hourly[1].gridExport).toBeCloseTo(8, 5)
    expect(result.hourly[1].batteryDischarge).toBeGreaterThan(0)
    // Battery should sit at reserve after peak
    expect(result.hourly[1].batteryLevel).toBeCloseTo(5, 5)
  })

  it('peak hour with deficit: covers home first, sells remainder above reserve', () => {
    // Cheap: charge to 10 kWh; Peak: deficit=2 → cover home, sell 3 above reserve
    const data = [surplus(CHEAP, 10), deficit(PEAK, 2)]
    const map = twoHourMap()
    const result = runSimulation(data, BATTERY_10KWH, SMART_50, map, 0.10)
    // Home fully covered from battery (no grid import)
    expect(result.hourly[1].gridImport).toBe(0)
    // Remainder above reserve sold: battery was 10, cover 2, then sell max(0, 8-5)=3
    expect(result.hourly[1].gridExport).toBeCloseTo(3, 5)
    expect(result.hourly[1].batteryDischarge).toBeGreaterThan(0)
  })

  it('allowGridChargeCheap: tops up battery during cheapest hours', () => {
    // 3 hours: two cheap, one expensive; battery starts empty, no solar
    const ts0 = '2024-06-01T00:00:00Z'
    const ts1 = '2024-06-01T01:00:00Z'
    const ts2 = '2024-06-01T12:00:00Z'
    const data = [empty(ts0), empty(ts1), empty(ts2)]
    const map = buildMap([
      { timestamp: ts0, price: 0.10 },
      { timestamp: ts1, price: 0.12 },
      { timestamp: ts2, price: 0.50 },
    ])
    const strategy = { sellFraction: 0.5, allowGridChargeCheap: true }
    const result = runSimulation(data, BATTERY_10KWH, strategy, map, null)
    // ts0 rank=0 < sellFraction*0.5=0.25 → isCheapHour, battery charges from grid
    expect(result.hourly[0].batteryCharge).toBeGreaterThan(0)
    expect(result.hourly[0].gridImport).toBeGreaterThan(0)
    // ts2 is peak (rank=1 > 0.5) → no grid charge
    expect(result.hourly[2].gridImport).toBe(0)
  })

  it('always charges from grid when price is negative (no flag needed)', () => {
    const ts0 = '2024-06-01T00:00:00Z'
    const ts1 = '2024-06-01T12:00:00Z'
    const data = [empty(ts0), empty(ts1)]
    const map = buildMap([
      { timestamp: ts0, price: -0.05 },
      { timestamp: ts1, price:  0.40 },
    ])
    // No allowGridChargeCheap needed — negative price charging is always active
    const result = runSimulation(data, BATTERY_10KWH, { sellFraction: 0.5 }, map, null)
    expect(result.hourly[0].batteryCharge).toBeGreaterThan(0)
    expect(result.hourly[0].gridImport).toBeGreaterThan(0)
  })

  it('charges from grid even when all prices are the same negative value (allSame bypass)', () => {
    // allSame=true blocks allowGridChargeCheap but negative-price charging ignores allSame
    const ts0 = '2024-06-01T00:00:00Z'
    const ts1 = '2024-06-01T12:00:00Z'
    const data = [empty(ts0), empty(ts1)]
    const map = buildMap([
      { timestamp: ts0, price: -0.05 },
      { timestamp: ts1, price: -0.05 },
    ])
    const negResult   = runSimulation(data, BATTERY_10KWH, { sellFraction: 0.5 }, map, null)
    const cheapResult = runSimulation(data, BATTERY_10KWH, { sellFraction: 0.5, allowGridChargeCheap: true }, map, null)
    // negative price always triggers charging regardless of allSame
    expect(negResult.hourly[0].batteryCharge).toBeGreaterThan(0)
    // allowGridChargeCheap is blocked by allSame but negative-price charging still runs
    expect(cheapResult.hourly[0].batteryCharge).toBeGreaterThan(0)
  })

  it('does not discharge battery when covering deficit at negative price', () => {
    // Day 1 (single hour, allSame): solar charges battery to 5 kWh
    // Day 2: negative price at night + peak at noon — battery should NOT deplete at negative hour
    const tsSolar = '2024-05-31T12:00:00Z'
    const tsNeg   = '2024-06-01T02:00:00Z'
    const tsPeak  = '2024-06-01T18:00:00Z'
    const data = [
      surplus(tsSolar, 5),
      makeHour(tsNeg, 0, 1, 0),  // 1 kWh home deficit at negative price
      empty(tsPeak),
    ]
    const map = buildMap([
      { timestamp: tsSolar, price: 0.20 },
      { timestamp: tsNeg,   price: -0.05 },
      { timestamp: tsPeak,  price:  0.40 },
    ])
    const result = runSimulation(data, BATTERY_10KWH, { sellFraction: 0.5 }, map, null)
    // Battery must NOT discharge — importing is profitable at negative price
    expect(result.hourly[1].batteryDischarge).toBe(0)
    // Home covered from grid (+ battery top-up from grid)
    expect(result.hourly[1].gridImport).toBeGreaterThanOrEqual(1)
  })

  it('isSellHour does not trigger when all daily prices are negative', () => {
    // Day 1: charges battery via solar; Day 2: both prices negative but different spread.
    // The "least negative" hour has rank=1 which would trigger isSellHour by rank alone,
    // but the buyPrice>0 guard must prevent selling at a negative price.
    const tsSolar = '2024-05-31T12:00:00Z'
    const tsLow   = '2024-06-01T02:00:00Z'  // -0.10 (cheapest)
    const tsHigh  = '2024-06-01T14:00:00Z'  // -0.02 (least negative = rank 1)
    const data = [
      surplus(tsSolar, 5),
      empty(tsLow),
      empty(tsHigh),
    ]
    const map = buildMap([
      { timestamp: tsSolar, price:  0.20 },
      { timestamp: tsLow,   price: -0.10 },
      { timestamp: tsHigh,  price: -0.02 },
    ])
    const result = runSimulation(data, BATTERY_10KWH, { sellFraction: 0.5 }, map, null)
    // tsHigh is rank=1 but price < 0 → isSellHour must be false → no selling, only cheap-charging
    expect(result.hourly[2].batteryDischarge).toBe(0)
    expect(result.hourly[2].gridExport).toBe(0)
  })

  it('produces positive savings: earns on negative-price import, sells at later peak', () => {
    const tsNeg  = '2024-06-01T02:00:00Z'
    const tsPeak = '2024-06-01T18:00:00Z'
    const data = [
      makeHour(tsNeg, 0, 1, 0),  // 1 kWh deficit, negative price
      empty(tsPeak),
    ]
    const map = buildMap([
      { timestamp: tsNeg,  price: -0.05 },
      { timestamp: tsPeak, price:  0.40 },
    ])
    const result = runSimulation(data, BATTERY_10KWH, { sellFraction: 0.5 }, map, null)
    expect(result.financial.annualSavings).toBeGreaterThan(0)
  })

  it('allowGridChargeCheap does not fire when all prices are the same', () => {
    const data = [
      makeHour('2024-06-01T00:00:00Z', 0, 0, 0),
      makeHour('2024-06-01T12:00:00Z', 0, 0, 0),
    ]
    const map = flatPriceMap(data, 0.20)  // allSame=true, positive → no cheap charge
    const strategy = { sellFraction: 0.5, allowGridChargeCheap: true }
    const result = runSimulation(data, BATTERY_10KWH, strategy, map, null)
    expect(result.hourly[0].batteryCharge).toBe(0)
    expect(result.hourly[0].gridImport).toBe(0)
  })

  it('all-same prices: no peak hours triggered, battery only serves home consumption', () => {
    const data = [
      makeHour('2024-06-01T10:00:00Z', 8, 0, 3),
      makeHour('2024-06-01T20:00:00Z', 0, 5, 0),
    ]
    const map = flatPriceMap(data, 0.30)
    // With flat prices allSame=true → isPeakHour always false → no selling
    const result = runSimulation(data, BATTERY_10KWH, SMART_50, map, 0.10)
    // Battery should never export to grid (only discharges for home deficit)
    expect(result.hourly[0].gridExport).toBe(0) // surplus hour: solar fills battery, no grid export
    expect(result.hourly[1].batteryDischarge).toBeGreaterThan(0) // deficit hour: battery covers home
  })

  it('sellFraction=0: battery never sells to grid at peak', () => {
    // Cheap: charge battery from solar; Peak: empty hour — sellFraction=0 means no peak detection
    const data = [surplus(CHEAP, 5), empty(PEAK)]
    const map = twoHourMap()
    const result = runSimulation(data, BATTERY_10KWH, SMART_0, map, 0.10)
    expect(result.hourly[1].batteryDischarge).toBe(0)
    expect(result.hourly[1].gridExport).toBe(0)
  })

  it('sellFraction=1: battery fully empties on the best-price hour', () => {
    // Cheap: charge 5 kWh; Peak: empty hour, sell everything (reserve=0)
    const data = [surplus(CHEAP, 5), empty(PEAK)]
    const map = twoHourMap()
    const result = runSimulation(data, BATTERY_10KWH, SMART_100, map, 0.10)
    expect(result.hourly[1].batteryLevel).toBeCloseTo(0, 5)
    expect(result.hourly[1].gridExport).toBeCloseTo(5, 5)
  })

  it('sell at peak earns more than never selling (dynamic sell price = buy price)', () => {
    // Cheap hour: solar surplus stored; Peak hour: sell stored energy at high price
    // When priceMap is provided, hourSell = buyPrice (dynamic, same as import price)
    const data = [surplus(CHEAP, 5), empty(PEAK)]
    const map = twoHourMap(0.10, 0.40)
    const sellResult = runSimulation(data, BATTERY_10KWH, SMART_100, map, null)
    const homeResult = runSimulation(data, BATTERY_10KWH, SMART_0, map, null)
    expect(sellResult.financial.annualSavings).toBeGreaterThan(homeResult.financial.annualSavings)
  })
})
