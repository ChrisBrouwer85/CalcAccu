import { useState } from 'react'
import { DUTCH_PRICE_HISTORY, fetchEnergyZeroPrices, buildHourlyPriceMap } from '../utils/energyPrices.js'

const YEARS = Object.keys(DUTCH_PRICE_HISTORY).sort().reverse()

export default function PriceConfig({ t, config, onChange, dataDateRange }) {
  const [fetchStatus, setFetchStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleFetch() {
    setLoading(true)
    setFetchStatus('')
    try {
      const from = config.fromDate || dataDateRange?.from
      const to = config.toDate || dataDateRange?.to
      if (!from || !to) {
        setFetchStatus('Please provide date range.')
        setLoading(false)
        return
      }
      const prices = await fetchEnergyZeroPrices(from, to)
      const map = buildHourlyPriceMap(prices)
      onChange({ ...config, hourlyPriceMap: map })
      setFetchStatus(`✅ ${prices.length} ${t('fetchSuccess')}`)
    } catch {
      setFetchStatus(`⚠️ ${t('fetchFailed')}`)
    } finally {
      setLoading(false)
    }
  }

  function handleYearChange(year) {
    const prices = DUTCH_PRICE_HISTORY[year]
    if (prices) {
      onChange({ ...config, selectedYear: year, buyPrice: prices.buy, sellPrice: prices.sell })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">{t('priceTitle')}</h3>
        <p className="text-sm text-gray-500">{t('priceSource')}</p>
      </div>

      {/* Source selector */}
      <div className="flex flex-col gap-3">
        {[
          { value: 'api', label: t('energyZeroApi'), emoji: '🌐' },
          { value: 'static', label: t('staticHistorical'), emoji: '📊' },
          { value: 'manual', label: t('manualEntry'), emoji: '✏️' },
        ].map(({ value, label, emoji }) => (
          <label key={value} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="priceSource"
              value={value}
              checked={config.source === value}
              onChange={() => onChange({ ...config, source: value })}
              className="accent-blue-600 w-4 h-4"
            />
            <span className="text-sm text-gray-700">{emoji} {label}</span>
          </label>
        ))}
      </div>

      {/* API source */}
      {config.source === 'api' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">{t('fromDate')}</label>
              <input
                type="date"
                value={config.fromDate || dataDateRange?.from || ''}
                onChange={e => onChange({ ...config, fromDate: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">{t('toDate')}</label>
              <input
                type="date"
                value={config.toDate || dataDateRange?.to || ''}
                onChange={e => onChange({ ...config, toDate: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <button
            onClick={handleFetch}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? t('fetching') : t('fetchPrices')}
          </button>
          {fetchStatus && (
            <p className="text-sm text-gray-700">{fetchStatus}</p>
          )}
        </div>
      )}

      {/* Static historical */}
      {config.source === 'static' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('year')}</label>
            <select
              value={config.selectedYear || YEARS[0]}
              onChange={e => handleYearChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-medium mb-3">{t('historicalRef')}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="font-medium text-gray-500">{t('year')}</div>
              <div className="font-medium text-gray-500">{t('buyPrice')}</div>
              <div className="font-medium text-gray-500">{t('sellPrice')}</div>
              {Object.entries(DUTCH_PRICE_HISTORY).sort(([a],[b]) => b-a).map(([year, { buy, sell }]) => (
                <>
                  <div key={year} className={`${config.selectedYear == year ? 'font-bold text-blue-700' : 'text-gray-700'}`}>{year}</div>
                  <div className={`${config.selectedYear == year ? 'font-bold text-blue-700' : 'text-gray-700'}`}>€{buy.toFixed(2)}</div>
                  <div className={`${config.selectedYear == year ? 'font-bold text-blue-700' : 'text-gray-700'}`}>€{sell.toFixed(2)}</div>
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual */}
      {config.source === 'manual' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyPrice')}</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">€</span>
              <input
                type="number"
                min="0"
                max="5"
                step="0.01"
                value={config.buyPrice}
                onChange={e => onChange({ ...config, buyPrice: parseFloat(e.target.value) })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('sellPrice')}</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">€</span>
              <input
                type="number"
                min="0"
                max="5"
                step="0.01"
                value={config.sellPrice}
                onChange={e => onChange({ ...config, sellPrice: parseFloat(e.target.value) })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
