export const DUTCH_PRICE_HISTORY = {
  2019: { buy: 0.21, sell: 0.21 },
  2020: { buy: 0.21, sell: 0.21 },
  2021: { buy: 0.22, sell: 0.22 },
  2022: { buy: 0.54, sell: 0.40 },
  2023: { buy: 0.35, sell: 0.12 },
  2024: { buy: 0.29, sell: 0.10 },
  2025: { buy: 0.27, sell: 0.09 },
}

export function getStaticPricesForYear(year) {
  if (DUTCH_PRICE_HISTORY[year]) return DUTCH_PRICE_HISTORY[year]
  const years = Object.keys(DUTCH_PRICE_HISTORY).map(Number).sort()
  const closest = years.reduce((a, b) => Math.abs(b - year) < Math.abs(a - year) ? b : a)
  return DUTCH_PRICE_HISTORY[closest]
}

export async function fetchEnergyZeroPrices(fromDate, tillDate) {
  const from = new Date(fromDate).toISOString()
  const till = new Date(tillDate).toISOString()
  const url = `https://api.energyzero.nl/v1/energyprices?fromDate=${encodeURIComponent(from)}&tillDate=${encodeURIComponent(till)}&interval=4&usageType=1&inclBtw=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`EnergyZero API error: ${res.status}`)
  const data = await res.json()
  const prices = (data.Prices || []).map(p => ({
    timestamp: new Date(p.readingDate),
    price: p.price / 100, // cents to euros — API returns ct/kWh
  }))
  return prices
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

export function getStaticPriceMap(hourlyData, buyPrice) {
  const map = new Map()
  for (const row of hourlyData) {
    map.set(hourKey(row.timestamp), buyPrice)
  }
  return map
}
