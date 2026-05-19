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

async function getCachedMonth(country, yearMonth) {
  if (!db) return null
  const snap = await getDoc(doc(db, 'marketPrices', `${country}-${yearMonth}`))
  if (!snap.exists()) return null
  return snap.data().hours // [{h, buy}]
}

async function setCachedMonth(country, yearMonth, hours) {
  if (!db) return
  await setDoc(doc(db, 'marketPrices', `${country}-${yearMonth}`), {
    country,
    month: yearMonth,
    hours,
    fetchedAt: Timestamp.now(),
  })
}

// Returns Map<hourKey, number> for the entire from→to range.
// Checks Firestore cache per month; fetches from EnergyZero for missing months.
export async function loadPricesForRange(country, fromDate, toDate) {
  if (country !== 'NL') throw new Error(`Unsupported country: ${country}. Only NL is supported.`)

  const months = monthsInRange(fromDate, toDate)
  const allHours = []

  for (const yearMonth of months) {
    let cached = await getCachedMonth(country, yearMonth)
    if (!cached) {
      const [year, month] = yearMonth.split('-').map(Number)
      const fetchFrom = new Date(year, month - 1, 1)
      const fetchTill = new Date(year, month, 1) // first day of next month
      const prices = await fetchEnergyZeroPrices(
        fetchFrom.toISOString().slice(0, 10),
        fetchTill.toISOString().slice(0, 10),
      )
      cached = prices.map(p => ({ h: hourKey(p.timestamp), buy: p.price }))
      await setCachedMonth(country, yearMonth, cached)
    }
    allHours.push(...cached)
  }

  // Filter to the exact requested range and build map
  const fromTs = new Date(fromDate).getTime()
  const toTs = new Date(toDate + 'T23:59:59').getTime()
  const map = new Map()
  for (const { h, buy } of allHours) {
    const ts = new Date(h).getTime()
    if (ts >= fromTs && ts <= toTs) {
      map.set(h, buy)
    }
  }
  return map
}
