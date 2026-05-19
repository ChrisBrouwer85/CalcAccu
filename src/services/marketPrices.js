import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { fetchEnergyZeroPrices, hourKey } from '../utils/energyPrices.js'

function monthsInRange(fromDate, toDate) {
  const months = []
  const start = new Date(fromDate)
  const end = new Date(toDate)
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cur <= end) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

// v2 suffix distinguishes all-in prices (market + VAT + energiebelasting) from
// the earlier cache (market + VAT only) so old entries are never reused.
function cacheKey(country, yearMonth) { return `${country}-${yearMonth}-v2` }

async function getCachedMonth(country, yearMonth) {
  if (!db) return null
  try {
    const snap = await getDoc(doc(db, 'marketPrices', cacheKey(country, yearMonth)))
    if (!snap.exists()) return null
    const hours = snap.data().hours
    if (!Array.isArray(hours) || hours.length === 0 || !hours[0]?.h) return null
    return hours
  } catch {
    // Firestore unavailable or permission denied → fall through to API fetch
    return null
  }
}

async function setCachedMonth(country, yearMonth, hours) {
  if (!db) return
  try {
    await setDoc(doc(db, 'marketPrices', cacheKey(country, yearMonth)), {
      country,
      month: yearMonth,
      hours,
      fetchedAt: Timestamp.now(),
    })
  } catch {
    // Cache write failed — non-critical, API data is still usable
  }
}

// Returns Map<hourKey, number> for the entire from→to range.
// Checks Firestore cache per month; fetches from EnergyZero for missing months.
// Firestore errors are non-fatal: always falls back to the API.
export async function loadPricesForRange(country, fromDate, toDate) {
  if (country !== 'NL') throw new Error(`Unsupported country: ${country}. Only NL is supported.`)

  const months = monthsInRange(fromDate, toDate)
  const allHours = []

  for (const yearMonth of months) {
    let cached = await getCachedMonth(country, yearMonth)
    if (!cached) {
      const [year, month] = yearMonth.split('-').map(Number)
      // Fetch the full calendar month; EnergyZero wants ISO date strings
      const fetchFrom = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
      const fetchTill = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
      const prices = await fetchEnergyZeroPrices(fetchFrom, fetchTill)
      cached = prices.map(p => ({ h: hourKey(p.timestamp), buy: p.price }))
      await setCachedMonth(country, yearMonth, cached)
    }
    allHours.push(...cached)
  }

  // Build map from all fetched/cached hours (no extra filtering — the month
  // boundaries already cover the requested range)
  const map = new Map()
  for (const { h, buy } of allHours) {
    map.set(h, buy)
  }
  return map
}
