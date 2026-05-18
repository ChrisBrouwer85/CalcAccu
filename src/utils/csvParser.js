const SOLAR_PATTERNS = ['solar', 'pv', 'panel', 'zon', 'zonne', 'yield']
const IMPORT_PATTERNS = ['import', 'consumed', 'afname', 'grid_in', 'inkoop', 'verbruik', 'consumption', 'from_grid', 'net_consumed']
const EXPORT_PATTERNS = ['export', 'return', 'teruglever', 'grid_out', 'feed', 'teruglevering', 'to_grid', 'delivered']

function matchesPattern(id, patterns) {
  const lower = id.toLowerCase()
  return patterns.some(p => lower.includes(p))
}

export function detectColumnMapping(sensorIds) {
  const mapping = { solar: '', gridImport: '', gridExport: '' }
  for (const id of sensorIds) {
    if (!mapping.solar && matchesPattern(id, SOLAR_PATTERNS)) mapping.solar = id
    else if (!mapping.gridImport && matchesPattern(id, IMPORT_PATTERNS)) mapping.gridImport = id
    else if (!mapping.gridExport && matchesPattern(id, EXPORT_PATTERNS)) mapping.gridExport = id
  }
  return mapping
}

export function parseCSV(rows) {
  // Group rows by statistic_id
  const byId = {}
  for (const row of rows) {
    const id = row.statistic_id || row.entity_id || row.sensor || ''
    if (!id) continue
    if (!byId[id]) byId[id] = []
    byId[id].push(row)
  }
  const sensorIds = Object.keys(byId).sort()
  const suggestedMapping = detectColumnMapping(sensorIds)
  return { byId, sensorIds, suggestedMapping }
}

function getNumericValue(row) {
  // Try sum first (cumulative counter), then state, then mean
  const candidates = ['sum', 'state', 'mean']
  for (const key of candidates) {
    const val = parseFloat(row[key])
    if (!isNaN(val)) return val
  }
  return null
}

function getTimestamp(row) {
  const raw = row.start || row.datetime || row.timestamp || row.date
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function computeDeltas(sensorRows) {
  // Sort by timestamp, compute per-hour delta from cumulative sum
  const sorted = [...sensorRows].sort((a, b) => {
    const ta = getTimestamp(a)
    const tb = getTimestamp(b)
    return ta - tb
  })

  const result = []
  let prevSum = null
  let prevTimestamp = null

  for (const row of sorted) {
    const ts = getTimestamp(row)
    const val = getNumericValue(row)
    if (!ts || val === null) continue

    let delta = null
    if (prevSum !== null) {
      delta = val - prevSum
      if (delta < 0) delta = 0 // meter reset or error
    }

    if (delta !== null) {
      result.push({ timestamp: ts, kwh: delta })
    }

    prevSum = val
    prevTimestamp = ts
  }
  return result
}

export function applyMapping(byId, mapping) {
  const solarRows = mapping.solar ? computeDeltas(byId[mapping.solar] || []) : []
  const importRows = mapping.gridImport ? computeDeltas(byId[mapping.gridImport] || []) : []
  const exportRows = mapping.gridExport ? computeDeltas(byId[mapping.gridExport] || []) : []

  // Index by hour key
  const solarMap = new Map(solarRows.map(r => [r.timestamp.toISOString(), r.kwh]))
  const importMap = new Map(importRows.map(r => [r.timestamp.toISOString(), r.kwh]))
  const exportMap = new Map(exportRows.map(r => [r.timestamp.toISOString(), r.kwh]))

  // Use import timestamps as the reference timeline (always required)
  const referenceRows = importRows.length ? importRows : solarRows
  const hourlyData = referenceRows.map(r => {
    const key = r.timestamp.toISOString()
    return {
      timestamp: r.timestamp,
      solar: solarMap.get(key) ?? 0,
      gridImport: importMap.get(key) ?? 0,
      gridExport: exportMap.get(key) ?? 0,
    }
  })

  return hourlyData
}
