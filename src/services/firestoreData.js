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

export function monthIdFromTimestamp(ts) {
  const d = ts instanceof Date ? ts : new Date(ts)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`
}

export function hourKeyFromTimestamp(ts) {
  const d = ts instanceof Date ? ts : new Date(ts)
  return `${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}`
}

export function monthIdToDate(monthId) {
  const [y, m] = monthId.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
}

export function hourKeyToDate(monthId, hourKey) {
  const [y, m] = monthId.split('-').map(Number)
  const [dd, hh] = hourKey.split('T').map(Number)
  return new Date(Date.UTC(y, m - 1, dd, hh))
}

function energyCollection(uid) {
  return collection(db, 'users', uid, 'energyData')
}

export async function saveEnergyData(uid, rows, source, onProgress) {
  if (!rows.length) return { months: 0, hours: 0 }

  // Group rows by monthId; collect hour entries per month
  const byMonth = new Map()
  for (const row of rows) {
    const ts = row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp)
    if (isNaN(ts.getTime())) continue
    const monthId = monthIdFromTimestamp(ts)
    const hourKey = hourKeyFromTimestamp(ts)
    let entry = byMonth.get(monthId)
    if (!entry) {
      entry = { month: ts, hours: {} }
      byMonth.set(monthId, entry)
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

  const monthIds = [...byMonth.keys()].sort()
  let done = 0
  // Chunk months at 400 ops per batch (well under 500 limit)
  for (let i = 0; i < monthIds.length; i += 400) {
    const chunk = monthIds.slice(i, i + 400)
    const batch = writeBatch(db)
    for (const monthId of chunk) {
      const { month, hours } = byMonth.get(monthId)
      const ref = doc(energyCollection(uid), monthId)
      // monthStart = first UTC instant of the month
      const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
      batch.set(ref, {
        month: Timestamp.fromDate(monthStart),
        hours,
        importedAt: Timestamp.now(),
      }, { merge: true })
    }
    await batch.commit()
    done += chunk.length
    onProgress?.(done, monthIds.length)
  }

  const totalHours = rows.length
  return { months: monthIds.length, hours: totalHours }
}

async function deleteDocsInChunks(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const chunk = refs.slice(i, i + 400)
    const batch = writeBatch(db)
    for (const ref of chunk) batch.delete(ref)
    await batch.commit()
  }
}

export async function clearAllEnergyData(uid) {
  // Months only — at most ~12/year. One getDocs is enough.
  const snap = await getDocs(energyCollection(uid))
  await deleteDocsInChunks(snap.docs.map(d => d.ref))
  return snap.size
}

export async function clearEnergyRange(uid, fromMonthId, toMonthId) {
  const q = query(
    energyCollection(uid),
    where(documentId(), '>=', fromMonthId),
    where(documentId(), '<=', toMonthId),
    orderBy(documentId()),
  )
  const snap = await getDocs(q)
  await deleteDocsInChunks(snap.docs.map(d => d.ref))
  return snap.size
}

export async function getEnergyRange(uid, fromMonthId, toMonthId) {
  const q = query(
    energyCollection(uid),
    where(documentId(), '>=', fromMonthId),
    where(documentId(), '<=', toMonthId),
    orderBy(documentId()),
  )
  const snap = await getDocs(q)
  const rows = []
  for (const docSnap of snap.docs) {
    const monthId = docSnap.id
    const data = docSnap.data()
    const hours = data.hours || {}
    for (const [hourKey, h] of Object.entries(hours)) {
      rows.push({
        timestamp: hourKeyToDate(monthId, hourKey),
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
    return { months: 0, hours: 0, firstMonthId: null, lastMonthId: null, sources: {} }
  }
  // Pull all month docs (≤ ~12/yr typical, very cheap)
  const allSnap = await getDocs(query(coll, orderBy(documentId())))
  let hours = 0
  const sources = {}
  let firstMonthId = null
  let lastMonthId = null
  for (const docSnap of allSnap.docs) {
    if (!firstMonthId) firstMonthId = docSnap.id
    lastMonthId = docSnap.id
    const hoursMap = docSnap.data().hours || {}
    hours += Object.keys(hoursMap).length
    for (const h of Object.values(hoursMap)) {
      if (h.source) sources[h.source] = (sources[h.source] ?? 0) + 1
    }
  }
  return {
    months: allSnap.size,
    hours,
    firstMonthId,
    lastMonthId,
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

// Re-export for callers that need it
export { deleteField }
