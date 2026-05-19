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

  return raw.map(p => ({
    timestamp: new Date(p.readingDate ?? p.timestamp ?? p.date),
    // API returns ct/kWh; guard against already-euro values (< 2 = likely €, > 2 = likely ct)
    price: p.price > 2 ? p.price / 100 : p.price,
  })).filter(p => !isNaN(p.timestamp) && isFinite(p.price))
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
