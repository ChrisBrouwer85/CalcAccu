import { detectColumnMapping } from './csvParser.js'

export class HAWebSocket {
  constructor(url, token) {
    this.url = url.replace(/\/$/, '')
    this.token = token
    this.ws = null
    this.msgId = 1
    this.pending = new Map() // id → { resolve, reject }
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.url
        .replace(/^http/, 'ws')
        .replace(/^https/, 'wss') + '/api/websocket'

      try {
        this.ws = new WebSocket(wsUrl)
      } catch (e) {
        reject(new Error('Failed to open WebSocket: ' + e.message))
        return
      }

      const onOpen = () => {} // auth_required arrives as first message

      const onMessage = (evt) => {
        let msg
        try { msg = JSON.parse(evt.data) } catch { return }

        if (msg.type === 'auth_required') {
          this.ws.send(JSON.stringify({ type: 'auth', access_token: this.token }))
          return
        }

        if (msg.type === 'auth_ok') {
          this.ws.removeEventListener('message', onMessage)
          this.ws.addEventListener('message', this._onMessage.bind(this))
          resolve()
          return
        }

        if (msg.type === 'auth_invalid') {
          this.ws.close()
          reject(new Error('Invalid access token'))
          return
        }
      }

      const onError = () => reject(new Error('WebSocket connection error'))
      const onClose = () => reject(new Error('Connection closed before auth'))

      this.ws.addEventListener('open', onOpen)
      this.ws.addEventListener('message', onMessage)
      this.ws.addEventListener('error', onError)
      this.ws.addEventListener('close', onClose)
    })
  }

  _onMessage(evt) {
    let msg
    try { msg = JSON.parse(evt.data) } catch { return }
    const p = this.pending.get(msg.id)
    if (!p) return
    this.pending.delete(msg.id)
    if (msg.success === false) {
      p.reject(new Error(msg.error?.message ?? 'HA command error'))
    } else {
      p.resolve(msg.result)
    }
  }

  _send(payload) {
    const id = this.msgId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ ...payload, id }))
    })
  }

  async getStates() {
    return this._send({ type: 'get_states' })
  }

  async fetchStatistics(sensorIds, startISO, endISO) {
    const payload = {
      start_time: startISO,
      end_time: endISO,
      statistic_ids: sensorIds,
      period: 'hour',
      types: ['sum', 'state'],
    }
    try {
      return await this._send({ type: 'recorder/statistics_during_period', ...payload })
    } catch (e) {
      if (/unknown.command/i.test(e.message)) {
        return this._send({ type: 'history/statistics_during_period', ...payload })
      }
      throw e
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export function getEnergyEntities(states) {
  return states
    .filter(s => s.attributes?.unit_of_measurement === 'kWh')
    .map(s => s.entity_id)
    .sort()
}

export function normalizeHAStats(rawStats, mapping) {
  // rawStats: { "sensor.foo": [{start: epochMs, sum: number|null, state: number|null}] }
  // Returns HourlyRecord[] same as applyMapping() in csvParser.js

  function extractSeries(sensorId) {
    const rows = rawStats[sensorId]
    if (!rows?.length) return []
    const sorted = [...rows].sort((a, b) => a.start - b.start)
    const result = []
    let prevSum = null
    for (const row of sorted) {
      const val = row.sum ?? row.state ?? null
      if (val === null) continue
      const ts = new Date(row.start)
      if (prevSum !== null) {
        const delta = Math.max(0, val - prevSum)
        result.push({ timestamp: ts, kwh: delta })
      }
      prevSum = val
    }
    return result
  }

  // Support both string (legacy) and array of { id, tariff } objects
  const importIds = Array.isArray(mapping.gridImport)
    ? mapping.gridImport.map(e => (typeof e === 'string' ? e : e.id)).filter(Boolean)
    : (mapping.gridImport ? [mapping.gridImport] : [])

  const exportIds = Array.isArray(mapping.gridExport)
    ? mapping.gridExport.map(e => (typeof e === 'string' ? e : e.id)).filter(Boolean)
    : (mapping.gridExport ? [mapping.gridExport] : [])

  const solarSeries = mapping.solar ? extractSeries(mapping.solar) : []

  const importSeriesBySensor = {}
  for (const id of importIds) {
    importSeriesBySensor[id] = extractSeries(id)
  }
  const exportSeriesBySensor = {}
  for (const id of exportIds) {
    exportSeriesBySensor[id] = extractSeries(id)
  }

  const solarMap = new Map(solarSeries.map(r => [r.timestamp.toISOString(), r.kwh]))

  const importMapBySensor = {}
  for (const [id, rows] of Object.entries(importSeriesBySensor)) {
    importMapBySensor[id] = new Map(rows.map(r => [r.timestamp.toISOString(), r.kwh]))
  }
  const exportMapBySensor = {}
  for (const [id, rows] of Object.entries(exportSeriesBySensor)) {
    exportMapBySensor[id] = new Map(rows.map(r => [r.timestamp.toISOString(), r.kwh]))
  }

  const firstImportRows = importIds.length > 0 ? importSeriesBySensor[importIds[0]] : []
  const reference = firstImportRows.length ? firstImportRows : solarSeries

  return reference.map(r => {
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

export function autoDetectSensors(entityIds) {
  const suggested = detectColumnMapping(entityIds)
  return {
    solar: suggested.solar || '',
    gridImport: suggested.gridImport ? [{ id: suggested.gridImport, tariff: 0.29 }] : [],
    gridExport: suggested.gridExport ? [{ id: suggested.gridExport, tariff: 0.10 }] : [],
  }
}
