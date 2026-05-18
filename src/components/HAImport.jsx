import { useState, useRef } from 'react'
import { HAWebSocket, getEnergyEntities, normalizeHAStats, autoDetectSensors } from '../utils/haConnector.js'
import { loadHaUrl, saveHaUrl, loadHaToken, saveHaToken } from '../utils/storage.js'

const DEFAULT_URL = 'http://homeassistant.local:8123'

function defaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - 1)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function HAImport({ t, onDataReady }) {
  const [url, setUrl] = useState(() => loadHaUrl() ?? DEFAULT_URL)
  const [token, setToken] = useState(() => loadHaToken() ?? '')
  const [showToken, setShowToken] = useState(false)
  const [status, setStatus] = useState('idle') // idle | connecting | connected | error
  const [errorMsg, setErrorMsg] = useState('')
  const [entityIds, setEntityIds] = useState([])
  const [mapping, setMapping] = useState({ solar: '', gridImport: '', gridExport: '' })
  const [dateRange, setDateRange] = useState(defaultDateRange)
  const [fetchStatus, setFetchStatus] = useState('idle') // idle | fetching | done | error
  const [fetchedRows, setFetchedRows] = useState(0)
  const [hourlyData, setHourlyData] = useState(null)

  const haRef = useRef(null)

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const haIsHttp = url.startsWith('http://')
  const showMixedWarning = isHttps && haIsHttp

  async function handleConnect() {
    if (haRef.current) {
      haRef.current.disconnect()
      haRef.current = null
    }
    setStatus('connecting')
    setErrorMsg('')
    setEntityIds([])
    setHourlyData(null)
    setFetchStatus('idle')

    const ha = new HAWebSocket(url, token)
    try {
      await ha.connect()
      haRef.current = ha
      setStatus('connected')

      const states = await ha.getStates()
      const ids = getEnergyEntities(states)
      setEntityIds(ids)

      const detected = autoDetectSensors(ids)
      setMapping(detected)
    } catch (e) {
      setStatus('error')
      setErrorMsg(e.message)
    }
  }

  function handleDisconnect() {
    if (haRef.current) {
      haRef.current.disconnect()
      haRef.current = null
    }
    setStatus('idle')
    setEntityIds([])
    setHourlyData(null)
    setFetchStatus('idle')
  }

  async function handleFetch() {
    if (!haRef.current) return
    const sensorIds = [mapping.solar, mapping.gridImport, mapping.gridExport].filter(Boolean)
    if (!sensorIds.length) return

    setFetchStatus('fetching')
    setErrorMsg('')
    try {
      const from = new Date(dateRange.from).toISOString()
      const to = new Date(dateRange.to + 'T23:59:59').toISOString()
      const rawStats = await haRef.current.fetchStatistics(sensorIds, from, to)
      const data = normalizeHAStats(rawStats, mapping)
      setHourlyData(data)
      setFetchedRows(data.length)
      setFetchStatus('done')
    } catch (e) {
      setFetchStatus('error')
      setErrorMsg(e.message)
    }
  }

  function handleUse() {
    if (hourlyData?.length) onDataReady(hourlyData)
  }

  return (
    <div className="space-y-5">
      {/* Mixed content warning */}
      {showMixedWarning && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm">
          ⚠️ {t('haMixedContentWarning')}
        </div>
      )}

      {/* Connection form */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('haUrl')}</label>
          <input
            type="url"
            value={url}
            onChange={e => { setUrl(e.target.value); saveHaUrl(e.target.value) }}
            disabled={status === 'connected'}
            placeholder="http://homeassistant.local:8123"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('haToken')}
          </label>
          <div className="flex gap-2">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => { setToken(e.target.value); saveHaToken(e.target.value) }}
              disabled={status === 'connected'}
              placeholder="eyJ…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowToken(v => !v)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              {showToken ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{t('haTokenHelp')}</p>
        </div>

        <div className="flex gap-3 items-center">
          {status !== 'connected' ? (
            <button
              onClick={handleConnect}
              disabled={!url || !token || status === 'connecting'}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {status === 'connecting' ? t('haConnecting') : t('haConnect')}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {t('haDisconnect')}
            </button>
          )}

          {status === 'connected' && (
            <span className="text-green-700 font-medium text-sm">{t('haConnected')}</span>
          )}
          {status === 'error' && (
            <span className="text-red-600 text-sm">⚠️ {t('haError')}: {errorMsg}</span>
          )}
        </div>
      </div>

      {/* Sensor mapping + date range */}
      {status === 'connected' && (
        <div className="border-t border-gray-100 pt-5 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">{t('haMapSensors')}</h3>
            {entityIds.length === 0 ? (
              <p className="text-sm text-amber-600">{t('haNoKwhSensors')}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { key: 'solar', label: t('mapSolar'), emoji: '🌞' },
                  { key: 'gridImport', label: t('mapGridImport'), emoji: '⬇️' },
                  { key: 'gridExport', label: t('mapGridExport'), emoji: '⬆️' },
                ].map(({ key, label, emoji }) => (
                  <div key={key}>
                    <label className="block text-sm text-gray-600 mb-1">{emoji} {label}</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={mapping[key]}
                      onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
                    >
                      <option value="">{t('haSelectSensor')}</option>
                      {entityIds.map(id => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date range */}
          <div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('haDateFrom')}</label>
                <input
                  type="date"
                  value={dateRange.from}
                  max={dateRange.to}
                  onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('haDateTo')}</label>
                <input
                  type="date"
                  value={dateRange.to}
                  min={dateRange.from}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>

          {/* Fetch button */}
          <button
            onClick={handleFetch}
            disabled={(!mapping.gridImport && !mapping.solar) || fetchStatus === 'fetching'}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {fetchStatus === 'fetching' ? t('haFetching') : t('haFetchData')}
          </button>

          {fetchStatus === 'error' && (
            <p className="text-sm text-red-600">⚠️ {errorMsg}</p>
          )}
        </div>
      )}

      {/* Fetched data confirmation */}
      {fetchStatus === 'done' && hourlyData && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-green-800">
              ✅ {fetchedRows} {t('haRowsFetched')}
            </p>
            <p className="text-sm text-green-600 mt-0.5">
              {new Date(hourlyData[0]?.timestamp).toLocaleDateString()} →{' '}
              {new Date(hourlyData[hourlyData.length - 1]?.timestamp).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={handleUse}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors"
          >
            {t('haUseData')}
          </button>
        </div>
      )}
    </div>
  )
}
