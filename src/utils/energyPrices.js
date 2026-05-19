// Dutch energiebelasting (electricity, residential, first bracket ≤ 2500 kWh/yr), excl. BTW.
// From 2023 the ODE surcharge was merged into EB. Rates published by Belastingdienst annually.
// Add new year's rate each January from https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/overige_belastingen/belastingen_op_milieugrondslag/tarieven_milieubelastingen
const EB_RATE_EXCL_VAT = {
  2022: 0.11527,  // EB €0.09952 + ODE €0.01575
  2023: 0.12795,
  2024: 0.12599,
  2025: 0.10628,
  // 2026 rate not yet in training data — update when Belastingplan 2026 is published
}
const VAT = 0.21
// Fallback used for years not in the table; update when new rates become known
const EB_FALLBACK_YEAR = 2025

function energieBelastingInclVat(year) {
  return (EB_RATE_EXCL_VAT[year] ?? EB_RATE_EXCL_VAT[EB_FALLBACK_YEAR]) * (1 + VAT)
}

export async function fetchEnergyZeroPrices(fromDate, tillDate) {
  const from = new Date(fromDate).toISOString()
  const till = new Date(tillDate).toISOString()
  const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${encodeURIComponent(from)}&tillDate=${encodeURIComponent(till)}&interval=4&usageType=1&inclBtw=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`EnergyZero API error: ${res.status}`)
  const data = await res.json()

  // Handle both 'Prices' (original) and 'prices' (possible API update)
  const raw = data.Prices ?? data.prices ?? []
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`EnergyZero returned no prices for ${fromDate} – ${tillDate}`)
  }

  return raw.map(p => {
    const timestamp = new Date(p.readingDate ?? p.timestamp ?? p.date)
    // API returns ct/kWh in older versions; guard: > 2 means ct/kWh, else already €/kWh
    const marketInclVat = p.price > 2 ? p.price / 100 : p.price
    // Add energiebelasting so prices match the all-in rates shown on energyzero.nl
    const price = marketInclVat + energieBelastingInclVat(timestamp.getFullYear())
    return { timestamp, price }
  }).filter(p => !isNaN(p.timestamp) && isFinite(p.price))
}

export function buildHourlyPriceMap(prices) {
  const map = new Map()
  for (const { timestamp, price } of prices) {
    map.set(hourKey(timestamp), price)
  }
  return map
}

export function hourKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}`
}
