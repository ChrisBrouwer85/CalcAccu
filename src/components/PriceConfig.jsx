import { useState } from 'react'
import { loadPricesForRange } from '../services/marketPrices.js'

const SUPPORTED_COUNTRIES = [
  { value: 'NL', label: 'priceNL' },
]

export default function PriceConfig({ t, config, onChange, dataDateRange }) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('') // '' | 'ok' | 'cached' | 'error'
  const [loadedCount, setLoadedCount] = useState(0)

  const from = config.fromDate || dataDateRange?.from || ''
  const to = config.toDate || dataDateRange?.to || ''

  async function handleLoad() {
    if (!from || !to) {
      setStatus('error')
      return
    }
    setLoading(true)
    setStatus('')
    try {
      const map = await loadPricesForRange(config.country || 'NL', from, to)
      setLoadedCount(map.size)
      onChange({ ...config, hourlyPriceMap: map, fromDate: from, toDate: to })
      setStatus('ok')
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const alreadyLoaded = config.hourlyPriceMap && config.hourlyPriceMap.size > 0

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">{t('priceTitle')}</h3>
      </div>

      {/* Country selector */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('priceCountry')}</label>
        <select
          value={config.country || 'NL'}
          onChange={e => onChange({ ...config, country: e.target.value, hourlyPriceMap: null })}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-full"
        >
          {SUPPORTED_COUNTRIES.map(c => (
            <option key={c.value} value={c.value}>{t(c.label)}</option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 block mb-1">{t('fromDate')}</label>
          <input
            type="date"
            value={from}
            onChange={e => onChange({ ...config, fromDate: e.target.value, hourlyPriceMap: null })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">{t('toDate')}</label>
          <input
            type="date"
            value={to}
            onChange={e => onChange({ ...config, toDate: e.target.value, hourlyPriceMap: null })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>

      <button
        onClick={handleLoad}
        disabled={loading || !from || !to}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
      >
        {loading ? t('fetching') : t('fetchPrices')}
      </button>

      {status === 'ok' && (
        <p className="text-sm text-green-700">
          ✅ {loadedCount} {t('fetchSuccess')}
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-amber-700">⚠️ {t('fetchFailed')}</p>
      )}
      {status === '' && alreadyLoaded && (
        <p className="text-sm text-gray-500">
          ✅ {config.hourlyPriceMap.size} {t('fetchSuccess')} — {t('priceCached')}
        </p>
      )}

      {/* Feed-in tariff */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('priceFeedin')}</label>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">€</span>
          <input
            type="number"
            min="0"
            max="5"
            step="0.01"
            value={config.sellPrice ?? 0.10}
            onChange={e => onChange({ ...config, sellPrice: parseFloat(e.target.value) })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>
    </div>
  )
}
