const KEYS = {
  haUrl: 'calcaccu:haUrl',
  haToken: 'calcaccu:haToken',
  haMapping: 'calcaccu:haMapping',
  hourlyData: 'calcaccu:hourlyData',
  savedSimulations: 'calcaccu:savedSimulations',
  sensorTariffs: 'calcaccu:sensorTariffs',
}

const MAX_SAVED = 10

// ── HA URL ────────────────────────────────────────────────────────────────────

export function loadHaUrl() {
  try {
    return localStorage.getItem(KEYS.haUrl)
  } catch {
    return null
  }
}

export function saveHaUrl(url) {
  try {
    localStorage.setItem(KEYS.haUrl, url)
  } catch (e) {
    console.warn('CalcAccu: could not save HA URL', e)
  }
}

// ── HA Token ──────────────────────────────────────────────────────────────────

export function loadHaToken() {
  try {
    return localStorage.getItem(KEYS.haToken)
  } catch {
    return null
  }
}

export function saveHaToken(token) {
  try {
    localStorage.setItem(KEYS.haToken, token)
  } catch (e) {
    console.warn('CalcAccu: could not save HA token', e)
  }
}

// ── Sensor tariffs ────────────────────────────────────────────────────────────

export function loadSensorTariffs() {
  try {
    const raw = localStorage.getItem(KEYS.sensorTariffs)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function saveSensorTariffs(tariffs) {
  try {
    localStorage.setItem(KEYS.sensorTariffs, JSON.stringify(tariffs))
  } catch (e) {
    console.warn('CalcAccu: could not save sensor tariffs', e)
  }
}

// ── HA sensor mapping ─────────────────────────────────────────────────────────

export function loadHaMapping() {
  try {
    const raw = localStorage.getItem(KEYS.haMapping)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveHaMapping(mapping) {
  try {
    localStorage.setItem(KEYS.haMapping, JSON.stringify(mapping))
  } catch (e) {
    console.warn('CalcAccu: could not save HA mapping', e)
  }
}

// ── Hourly data ───────────────────────────────────────────────────────────────

export function loadHourlyData() {
  try {
    const raw = localStorage.getItem(KEYS.hourlyData)
    if (!raw) return null
    const rows = JSON.parse(raw)
    return rows.map(r => ({ ...r, timestamp: new Date(r.timestamp) }))
  } catch {
    return null
  }
}

export function saveHourlyData(rows) {
  try {
    const serialized = rows.map(r => ({
      ...r,
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
    }))
    localStorage.setItem(KEYS.hourlyData, JSON.stringify(serialized))
  } catch (e) {
    console.warn('CalcAccu: could not save hourly data', e)
  }
}

// ── priceConfig serialization ─────────────────────────────────────────────────

export function serializePriceConfig(cfg) {
  if (!cfg) return cfg
  return {
    ...cfg,
    hourlyPriceMap: cfg.hourlyPriceMap instanceof Map
      ? Object.fromEntries(cfg.hourlyPriceMap)
      : cfg.hourlyPriceMap ?? null,
  }
}

export function deserializePriceConfig(raw) {
  if (!raw) return raw
  return {
    ...raw,
    hourlyPriceMap: raw.hourlyPriceMap && typeof raw.hourlyPriceMap === 'object' && !Array.isArray(raw.hourlyPriceMap)
      ? new Map(Object.entries(raw.hourlyPriceMap))
      : null,
  }
}

// ── simulationResults serialization ──────────────────────────────────────────

export function serializeSimResults(results) {
  return results.map(({ sizeKwh, result }) => ({
    sizeKwh,
    result: {
      monthly: result.monthly,
      totals: result.totals,
      financial: result.financial,
    },
  }))
}

// ── Name generation ───────────────────────────────────────────────────────────

export function generateSimName(date = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ── Saved simulations ─────────────────────────────────────────────────────────

export function loadSavedSimulations() {
  try {
    const raw = localStorage.getItem(KEYS.savedSimulations)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveSimulation(sim) {
  try {
    const current = loadSavedSimulations()
    const updated = [sim, ...current]
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, MAX_SAVED)
    localStorage.setItem(KEYS.savedSimulations, JSON.stringify(updated))
    return updated
  } catch (e) {
    console.warn('CalcAccu: could not save simulation', e)
    return loadSavedSimulations()
  }
}

export function deleteSavedSimulation(id) {
  try {
    const current = loadSavedSimulations()
    const updated = current.filter(s => s.id !== id)
    localStorage.setItem(KEYS.savedSimulations, JSON.stringify(updated))
    return updated
  } catch (e) {
    console.warn('CalcAccu: could not delete simulation', e)
    return loadSavedSimulations()
  }
}
