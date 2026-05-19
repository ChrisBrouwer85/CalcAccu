export async function fetchEnergyZeroPrices(fromDate, tillDate) {
  const from = new Date(fromDate).toISOString()
  const till = new Date(tillDate).toISOString()
  const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${encodeURIComponent(from)}&tillDate=${encodeURIComponent(till)}&interval=4&usageType=1&inclBtw=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`EnergyZero API error: ${res.status}`)
  const data = await res.json()
  return (data.Prices || []).map(p => ({
    timestamp: new Date(p.readingDate),
    price: p.price / 100,
  }))
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
