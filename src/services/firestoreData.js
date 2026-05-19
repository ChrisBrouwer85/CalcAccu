import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  writeBatch,
  documentId,
  Timestamp,
  deleteField,
} from 'firebase/firestore'
import { db } from '../firebase.js'

const pad2 = (n) => String(n).padStart(2, '0')

// Each Firestore doc holds a single UTC day's worth of hourly readings.
// Doc ID format: 'YYYY-MM-DD'. Hour keys inside the `hours` map: '00'..'23'.
// This keeps every doc tiny (≤24 entries) so multi-year imports never hit
// Firestore's 10 MiB transaction limit or the 1 MiB per-doc cap.
const BATCH_DOC_LIMIT = 200

export function dayIdFromTimestamp(ts) {
  const d = ts instanceof Date ? ts : new Date(ts)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

export function hourKeyFromTimestamp(ts) {
  const d = ts instanceof Date ? ts : new Date(ts)
  return pad2(d.getUTCHours())
}

export function monthIdFromDayId(dayId) {
  return dayId.slice(0, 7)
}

function monthRangeToDayRange(fromMonthId, toMonthId) {
  return {
    from: `${fromMonthId}-01`,
    // '-32' sorts after any valid 'YYYY-MM-DD' for that month
    to: `${toMonthId}-32`,
  }
}

export function hourKeyToDate(dayId, hourKey) {
  const [y, m, d] = dayId.split('-').map(Number)
  const hh = parseInt(hourKey, 10)
  return new Date(Date.UTC(y, m - 1, d, hh))
}

function energyCollection(uid) {
  return collection(db, 'users', uid, 'energyData')
}

export async function saveEnergyData(uid, rows, source, onProgress) {
  if (!rows.length) return { days: 0, months: 0, hours: 0 }

  // Group rows by dayId; collect hour entries per day
  const byDay = new Map()
  for (const row of rows) {
    const ts = row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp)
    if (isNaN(ts.getTime())) continue
    const dayId = dayIdFromTimestamp(ts)
    const hourKey = hourKeyFromTimestamp(ts)
    let entry = byDay.get(dayId)
    if (!entry) {
      entry = { day: ts, hours: {} }
      byDay.set(dayId, entry)
    }
    const hourEntry = {
      solar: row.solar ?? 0,
      gridImport: row.gridImport ?? 0,
      gridExport: row.gridExport ?? 0,
      source,
    }
    if (row.sensorImport && Object.keys(row.sensorImport).length > 0) {
      hourEntry.sensorImport = row.sensorImport
    }
    if (row.sensorExport && Object.keys(row.sensorExport).length > 0) {
      hourEntry.sensorExport = row.sensorExport
    }
    entry.hours[hourKey] = hourEntry
  }

  const dayIds = [...byDay.keys()].sort()
  const months = new Set(dayIds.map(monthIdFromDayId))
  let done = 0
  for (let i = 0; i < dayIds.length; i += BATCH_DOC_LIMIT) {
    const chunk = dayIds.slice(i, i + BATCH_DOC_LIMIT)
    const batch = writeBatch(db)
    for (const dayId of chunk) {
      const { day, hours } = byDay.get(dayId)
      const ref = doc(energyCollection(uid), dayId)
      const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
      batch.set(ref, {
        day: Timestamp.fromDate(dayStart),
        hours,
        importedAt: Timestamp.now(),
      }, { merge: true })
    }
    await batch.commit()
    done += chunk.length
    onProgress?.(done, dayIds.length)
  }

  return { days: dayIds.length, months: months.size, hours: rows.length }
}

async function deleteDocsInChunks(refs) {
  for (let i = 0; i < refs.length; i += BATCH_DOC_LIMIT) {
    const chunk = refs.slice(i, i + BATCH_DOC_LIMIT)
    const batch = writeBatch(db)
    for (const ref of chunk) batch.delete(ref)
    await batch.commit()
  }
}

export async function clearAllEnergyData(uid) {
  const snap = await getDocs(energyCollection(uid))
  await deleteDocsInChunks(snap.docs.map(d => d.ref))
  return snap.size
}

export async function clearEnergyRange(uid, fromMonthId, toMonthId) {
  const { from, to } = monthRangeToDayRange(fromMonthId, toMonthId)
  const q = query(
    energyCollection(uid),
    where(documentId(), '>=', from),
    where(documentId(), '<=', to),
    orderBy(documentId()),
  )
  const snap = await getDocs(q)
  await deleteDocsInChunks(snap.docs.map(d => d.ref))
  return snap.size
}

export async function getEnergyRange(uid, fromMonthId, toMonthId) {
  const { from, to } = monthRangeToDayRange(fromMonthId, toMonthId)
  const q = query(
    energyCollection(uid),
    where(documentId(), '>=', from),
    where(documentId(), '<=', to),
    orderBy(documentId()),
  )
  const snap = await getDocs(q)
  const rows = []
  for (const docSnap of snap.docs) {
    const dayId = docSnap.id
    const data = docSnap.data()
    const hours = data.hours || {}
    for (const [hourKey, h] of Object.entries(hours)) {
      rows.push({
        timestamp: hourKeyToDate(dayId, hourKey),
        solar: h.solar ?? 0,
        gridImport: h.gridImport ?? 0,
        gridExport: h.gridExport ?? 0,
        sensorImport: h.sensorImport ?? {},
        sensorExport: h.sensorExport ?? {},
        source: h.source,
      })
    }
  }
  rows.sort((a, b) => a.timestamp - b.timestamp)
  return rows
}

export async function getEnergyStats(uid) {
  const coll = energyCollection(uid)
  const firstSnap = await getDocs(query(coll, orderBy(documentId()), limit(1)))
  if (firstSnap.empty) {
    return { months: 0, days: 0, hours: 0, firstMonthId: null, lastMonthId: null, sources: {} }
  }
  // Pull all day docs to derive month range, hour count and source breakdown.
  // Even 5 years = ~1825 reads — fine for a manual page load.
  const allSnap = await getDocs(query(coll, orderBy(documentId())))
  let hours = 0
  const sources = {}
  const monthSet = new Set()
  let firstDayId = null
  let lastDayId = null
  for (const docSnap of allSnap.docs) {
    if (!firstDayId) firstDayId = docSnap.id
    lastDayId = docSnap.id
    monthSet.add(monthIdFromDayId(docSnap.id))
    const hoursMap = docSnap.data().hours || {}
    hours += Object.keys(hoursMap).length
    for (const h of Object.values(hoursMap)) {
      if (h.source) sources[h.source] = (sources[h.source] ?? 0) + 1
    }
  }
  return {
    months: monthSet.size,
    days: allSnap.size,
    hours,
    firstMonthId: firstDayId ? monthIdFromDayId(firstDayId) : null,
    lastMonthId: lastDayId ? monthIdFromDayId(lastDayId) : null,
    sources,
  }
}

export async function cleanupLegacySimulations(uid) {
  const ref = collection(db, 'users', uid, 'simulations')
  const snap = await getDocs(ref)
  if (snap.empty) return 0
  await deleteDocsInChunks(snap.docs.map(d => d.ref))
  return snap.size
}

export { deleteField }
