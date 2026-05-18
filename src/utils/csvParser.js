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
  }
  return result
}

export function applyMapping(byId, mapping) {
  const solarRows = mapping.solar ? computeDeltas(byId[mapping.solar] || []) : []

  // Support both string (legacy) and array of sensor IDs
  const importIds = Array.isArray(mapping.gridImport)
    ? mapping.gridImport.filter(Boolean)
    : (mapping.gridImport ? [mapping.gridImport] : [])

  const exportIds = Array.isArray(mapping.gridExport)
    ? mapping.gridExport.filter(Boolean)
    : (mapping.gridExport ? [mapping.gridExport] : [])

  // Compute deltas per sensor
  const importSeriesBySensor = {}
  for (const id of importIds) {
    importSeriesBySensor[id] = computeDeltas(byId[id] || [])
  }
  const exportSeriesBySensor = {}
  for (const id of exportIds) {
    exportSeriesBySensor[id] = computeDeltas(byId[id] || [])
  }

  // Build lookup maps per sensor
  const importMapBySensor = {}
  for (const [id, rows] of Object.entries(importSeriesBySensor)) {
    importMapBySensor[id] = new Map(rows.map(r => [r.timestamp.toISOString(), r.kwh]))
  }
  const exportMapBySensor = {}
  for (const [id, rows] of Object.entries(exportSeriesBySensor)) {
    exportMapBySensor[id] = new Map(rows.map(r => [r.timestamp.toISOString(), r.kwh]))
  }

  const solarMap = new Map(solarRows.map(r => [r.timestamp.toISOString(), r.kwh]))

  // Reference timeline: first import sensor, or solar
  const firstImportRows = importIds.length > 0 ? importSeriesBySensor[importIds[0]] : []
  const referenceRows = firstImportRows.length ? firstImportRows : solarRows

  return referenceRows.map(r => {
    const key = r.timestamp.toISOString()

    const sensorImport = {}
    let totalImport = 0
    for (const id of importIds) {
      const kwh = importMapBySensor[id]?.get(key) ?? 0
      sensorImport[id] = kwh
      totalImport += kwh
    }

    const sensorExport = {}
    let totalExport = 0
    for (const id of exportIds) {
      const kwh = exportMapBySensor[id]?.get(key) ?? 0
      sensorExport[id] = kwh
      totalExport += kwh
    }

    return {
      timestamp: r.timestamp,
      solar: solarMap.get(key) ?? 0,
      gridImport: totalImport,
      gridExport: totalExport,
      sensorImport,
      sensorExport,
    }
  })
}
