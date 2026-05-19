import { hourKey } from './energyPrices.js'

function sensorCost(sensorMap, sensorTariffs, fallbackPrice) {
  return Object.entries(sensorMap).reduce((sum, [id, kwh]) => {
    return sum + kwh * (sensorTariffs[id] ?? fallbackPrice)
  }, 0)
}

// Returns Map<'YYYY-MM-DD', { priceRank(price)→0..1, allSame: bool }>
function buildDailyPriceStats(hourlyData, priceMap, fallback) {
  const byDay = new Map()
  for (const row of hourlyData) {
    const key = hourKey(row.timestamp)
    const day = key.slice(0, 10)
    const price = priceMap?.get(key) ?? fallback
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(price)
  }
  const stats = new Map()
  for (const [day, prices] of byDay) {
    const sorted = [...prices].sort((a, b) => a - b)
    const allSame = sorted[0] === sorted[sorted.length - 1]
    stats.set(day, {
      allSame,
      priceRank: (price) => {
        if (allSame) return 0
        const below = sorted.filter(p => p < price).length
        return below / (sorted.length - 1)
      },
    })
  }
  return stats
}

export function runSimulation(hourlyData, batteryConfig, strategy, priceMap, sellPrice, sensorTariffs = null) {
  const {
    capacityKwh,
    chargeEfficiency = 0.95,
    dischargeEfficiency = 0.95,
    maxChargeRateKw = 5,
    maxDischargeRateKw = 5,
  } = batteryConfig

  const { sellFraction = 0.5, allowGridCharge = false } = strategy

  const fallbackBuyPrice = 0.27
  const dailyStats = buildDailyPriceStats(hourlyData, priceMap, fallbackBuyPrice)

  let battery = 0
  const hourly = []
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    monthIdx: i,
    solar: 0,
    gridImport: 0,
    gridExport: 0,
    batteryCharge: 0,
    batteryDischarge: 0,
    baselineGridImport: 0,
    baselineGridExport: 0,
    savings: 0,
    baselineCost: 0,
    actualCost: 0,
    baselineRevenue: 0,
    actualRevenue: 0,
  }))

  let totalGridImport = 0
  let totalGridExport = 0
  let totalBaselineImport = 0
  let totalBaselineExport = 0
  let totalSolar = 0
  let totalBatteryCharge = 0
  let totalBatteryDischarge = 0
  let totalHomeConsumption = 0

  for (const row of hourlyData) {
    const {
      timestamp,
      solar,
      gridImport: rawGridImport,
      gridExport: rawGridExport,
      sensorImport = {},
      sensorExport = {},
    } = row
    const monthIdx = new Date(timestamp).getMonth()

    const homeConsumption = Math.max(0, solar + rawGridImport - rawGridExport)
    totalHomeConsumption += homeConsumption

    const baselineImport = rawGridImport
    const baselineExport = rawGridExport
    totalBaselineImport += baselineImport
    totalBaselineExport += baselineExport

    const net = solar - homeConsumption

    let batteryCharge = 0
    let batteryDischarge = 0
    let gridImport = 0
    let gridExport = 0

    const key = hourKey(timestamp)
    const buyPrice = priceMap ? (priceMap.get(key) ?? fallbackBuyPrice) : fallbackBuyPrice

    const day = key.slice(0, 10)
    const dayStats = dailyStats.get(day)
    const rank = dayStats ? dayStats.priceRank(buyPrice) : 0
    const allSame = dayStats ? dayStats.allSame : true

    // Reserve: keep (1-sellFraction) of currently stored energy for home use.
    // Using battery (not capacityKwh) so a large undercharged battery still sells.
    const reserve = battery * (1 - sellFraction)

    // Peak: top sellFraction of the day's prices → sell from battery
    // Strict > so the cheapest hour is never treated as peak (handles sellFraction=1 edge case)
    const isPeakHour = sellFraction > 0 && !allSame && rank > (1 - sellFraction)
    // Cheap: bottom (sellFraction/2) → optionally charge from grid
    const isCheapHour = allowGridCharge && !allSame && rank < sellFraction * 0.5

    if (isPeakHour) {
      if (net >= 0) {
        // Export all solar surplus; don't charge battery
        gridExport = net
        // Sell battery above reserve
        const sellable = Math.max(0, battery - reserve)
        const sellKwh = Math.min(sellable, maxDischargeRateKw)
        battery = Math.max(0, battery - sellKwh / dischargeEfficiency)
        batteryDischarge = sellKwh
        gridExport += sellKwh * dischargeEfficiency
      } else {
        // Cover home from battery first (home always wins)
        const deficit = -net
        const homeKwh = Math.min(battery, maxDischargeRateKw, deficit)
        battery = Math.max(0, battery - homeKwh / dischargeEfficiency)
        const covered = homeKwh * dischargeEfficiency
        gridImport = Math.max(0, deficit - covered)
        batteryDischarge = homeKwh
        // Sell what remains above reserve, within rate cap
        const rateLeft = maxDischargeRateKw - homeKwh
        const sellable = Math.max(0, battery - reserve)
        const sellKwh = Math.min(sellable, rateLeft)
        battery = Math.max(0, battery - sellKwh / dischargeEfficiency)
        batteryDischarge += sellKwh
        gridExport = sellKwh * dischargeEfficiency
      }
    } else if (isCheapHour) {
      // Normal solar/home balance with full self-consumption priority
      if (net >= 0) {
        const charge = Math.min(net, maxChargeRateKw, capacityKwh - battery)
        battery = Math.min(capacityKwh, battery + charge * chargeEfficiency)
        batteryCharge = charge
        gridExport = net - charge
      } else {
        const deficit = -net
        const dis = Math.min(battery, maxDischargeRateKw, deficit)
        battery = Math.max(0, battery - dis / dischargeEfficiency)
        batteryDischarge = dis
        gridImport = Math.max(0, deficit - dis * dischargeEfficiency)
      }
      // Top up battery from grid (arbitrage)
      const space = capacityKwh - battery
      if (space > 0.01) {
        const gridChargeKwh = Math.min(space / chargeEfficiency, maxChargeRateKw)
        battery = Math.min(capacityKwh, battery + gridChargeKwh * chargeEfficiency)
        batteryCharge += gridChargeKwh
        gridImport += gridChargeKwh
      }
    } else {
      // Normal hour: maximize self-consumption (full priority)
      if (net >= 0) {
        const charge = Math.min(net, maxChargeRateKw, capacityKwh - battery)
        battery = Math.min(capacityKwh, battery + charge * chargeEfficiency)
        batteryCharge = charge
        gridExport = net - charge
      } else {
        const deficit = -net
        const dis = Math.min(battery, maxDischargeRateKw, deficit)
        battery = Math.max(0, battery - dis / dischargeEfficiency)
        batteryDischarge = dis
        gridImport = Math.max(0, deficit - dis * dischargeEfficiency)
      }
    }

    totalGridImport += gridImport
    totalGridExport += gridExport
    totalSolar += solar
    totalBatteryCharge += batteryCharge
    totalBatteryDischarge += batteryDischarge

    // Dynamic: use the same hourly price for selling (saldering / spot contract).
    // Falls back to the fixed feed-in tariff only when no price map is loaded.
    const hourSell = priceMap ? buyPrice : (sellPrice ?? 0.27)

    const hasSensorTariffs = sensorTariffs && Object.keys(sensorTariffs).length > 0
    const hasImportSensors = Object.keys(sensorImport).length > 0
    const hasExportSensors = Object.keys(sensorExport).length > 0

    let baselineCost, actualCost, baselineRevenue, actualRevenue

    if (hasSensorTariffs && hasImportSensors) {
      baselineCost = sensorCost(sensorImport, sensorTariffs, buyPrice)
      const importScale = rawGridImport > 0 ? gridImport / rawGridImport : 0
      const scaledImport = Object.fromEntries(
        Object.entries(sensorImport).map(([id, kwh]) => [id, kwh * importScale])
      )
      actualCost = sensorCost(scaledImport, sensorTariffs, buyPrice)
    } else {
      baselineCost = baselineImport * buyPrice
      actualCost = gridImport * buyPrice
    }

    if (hasSensorTariffs && hasExportSensors) {
      baselineRevenue = sensorCost(sensorExport, sensorTariffs, hourSell)
      const exportScale = rawGridExport > 0 ? gridExport / rawGridExport : 0
      const scaledExport = Object.fromEntries(
        Object.entries(sensorExport).map(([id, kwh]) => [id, kwh * exportScale])
      )
      actualRevenue = sensorCost(scaledExport, sensorTariffs, hourSell)
    } else {
      baselineRevenue = baselineExport * hourSell
      actualRevenue = gridExport * hourSell
    }

    const hourSavings = (baselineCost - actualCost) + (actualRevenue - baselineRevenue)

    const mo = monthly[monthIdx]
    mo.solar += solar
    mo.gridImport += gridImport
    mo.gridExport += gridExport
    mo.batteryCharge += batteryCharge
    mo.batteryDischarge += batteryDischarge
    mo.baselineGridImport += baselineImport
    mo.baselineGridExport += baselineExport
    mo.savings += hourSavings
    mo.baselineCost += baselineCost
    mo.actualCost += actualCost
    mo.baselineRevenue += baselineRevenue
    mo.actualRevenue += actualRevenue

    hourly.push({
      timestamp,
      solar,
      homeConsumption,
      gridImport,
      gridExport,
      batteryCharge,
      batteryDischarge,
      batteryLevel: battery,
    })
  }

  const selfSufficiency = totalHomeConsumption > 0
    ? Math.max(0, (1 - totalGridImport / totalHomeConsumption) * 100)
    : 0
  const baselineSelfSufficiency = totalHomeConsumption > 0
    ? Math.max(0, (1 - totalBaselineImport / totalHomeConsumption) * 100)
    : 0

  const periodSavings = monthly.reduce((s, m) => s + m.savings, 0)

  // Annualize: scale the period total to a 365-day year so payback is correct
  // regardless of how many months the user selected.
  const firstTs = hourlyData.length > 0 ? new Date(hourlyData[0].timestamp) : null
  const lastTs  = hourlyData.length > 0 ? new Date(hourlyData[hourlyData.length - 1].timestamp) : null
  const periodDays = (firstTs && lastTs && lastTs > firstTs)
    ? (lastTs - firstTs) / 86400000 + 1
    : Math.max(1, hourlyData.length / 24)
  const scale = 365 / periodDays

  const annualSavings = periodSavings * scale

  const annualBaselineCost    = monthly.reduce((s, m) => s + m.baselineCost, 0)    * scale
  const annualActualCost      = monthly.reduce((s, m) => s + m.actualCost, 0)      * scale
  const annualBaselineRevenue = monthly.reduce((s, m) => s + m.baselineRevenue, 0) * scale
  const annualActualRevenue   = monthly.reduce((s, m) => s + m.actualRevenue, 0)   * scale
  // Net cost = what you pay minus what you earn from export
  const annualBaselineNetCost = annualBaselineCost - annualBaselineRevenue
  const annualActualNetCost   = annualActualCost   - annualActualRevenue

  return {
    hourly,
    monthly,
    totals: {
      solarTotal: totalSolar,
      gridImport: totalGridImport,
      gridExport: totalGridExport,
      baselineGridImport: totalBaselineImport,
      baselineGridExport: totalBaselineExport,
      batteryCharge: totalBatteryCharge,
      batteryDischarge: totalBatteryDischarge,
      homeConsumption: totalHomeConsumption,
      selfSufficiency,
      baselineSelfSufficiency,
    },
    financial: {
      periodSavings,
      periodDays: Math.round(periodDays),
      annualSavings,
      annualBaselineCost,
      annualActualCost,
      annualBaselineRevenue,
      annualActualRevenue,
      annualBaselineNetCost,
      annualActualNetCost,
    },
  }
}
