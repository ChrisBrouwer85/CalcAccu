import { hourKey } from './energyPrices.js'

export function runSimulation(hourlyData, batteryConfig, strategy, priceMap, sellPrice) {
  const {
    capacityKwh,
    chargeEfficiency = 0.95,
    dischargeEfficiency = 0.95,
    maxChargeRateKw = 5,
    maxDischargeRateKw = 5,
  } = batteryConfig

  const { homePriority = 0.8 } = strategy

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
    const { timestamp, solar, gridImport: rawGridImport, gridExport: rawGridExport } = row
    const monthIdx = new Date(timestamp).getMonth()

    // Derive home consumption from energy balance
    const homeConsumption = Math.max(0, solar + rawGridImport - rawGridExport)
    totalHomeConsumption += homeConsumption

    // Baseline (no battery)
    const baselineImport = rawGridImport
    const baselineExport = rawGridExport
    totalBaselineImport += baselineImport
    totalBaselineExport += baselineExport

    // Net solar after home consumption
    const net = solar - homeConsumption

    let batteryCharge = 0
    let batteryDischarge = 0
    let gridImport = 0
    let gridExport = 0

    if (net >= 0) {
      // Solar surplus — charge battery
      const chargeable = Math.min(net * homePriority, maxChargeRateKw, capacityKwh - battery)
      const actualCharge = Math.max(0, chargeable)
      battery = Math.min(capacityKwh, battery + actualCharge * chargeEfficiency)
      batteryCharge = actualCharge

      // Remaining surplus goes to grid
      gridExport = net - actualCharge
    } else {
      // Deficit — discharge battery
      const deficit = Math.abs(net)
      const dischargeable = Math.min(deficit * homePriority, maxDischargeRateKw, battery)
      const actualDischarge = Math.max(0, dischargeable)
      battery = Math.max(0, battery - actualDischarge / dischargeEfficiency)
      const covered = actualDischarge * dischargeEfficiency
      batteryDischarge = actualDischarge

      gridImport = Math.max(0, deficit - covered)
    }

    totalGridImport += gridImport
    totalGridExport += gridExport
    totalSolar += solar
    totalBatteryCharge += batteryCharge
    totalBatteryDischarge += batteryDischarge

    const buyPrice = priceMap ? (priceMap.get(hourKey(timestamp)) ?? 0.27) : 0.27
    const hourSell = sellPrice ?? buyPrice * 0.3

    const hourSavings = (baselineImport - gridImport) * buyPrice - (baselineExport - gridExport) * hourSell

    const mo = monthly[monthIdx]
    mo.solar += solar
    mo.gridImport += gridImport
    mo.gridExport += gridExport
    mo.batteryCharge += batteryCharge
    mo.batteryDischarge += batteryDischarge
    mo.baselineGridImport += baselineImport
    mo.baselineGridExport += baselineExport
    mo.savings += hourSavings

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

  const annualSavings = monthly.reduce((s, m) => s + m.savings, 0)

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
      annualSavings,
    },
  }
}
