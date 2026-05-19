import { useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import { usePriceConfig } from '../context/PriceContext.jsx'
import { useEnergyStats } from '../hooks/useEnergyStats.js'
import { MONTHS } from '../i18n.js'

// ─── Data helpers ──────────────────────────────────────────────────────────

function computeStats(map) {
  if (!map || map.size === 0) return null
  const entries = Array.from(map.entries())
  const prices = entries.map(([, p]) => p).sort((a, b) => a - b)
  const n = prices.length
  const sum = prices.reduce((s, p) => s + p, 0)
  return {
    count: n,
    min: prices[0],
    max: prices[n - 1],
    avg: sum / n,
    median: n % 2 === 0 ? (prices[n / 2 - 1] + prices[n / 2]) / 2 : prices[Math.floor(n / 2)],
    p10: prices[Math.floor(n * 0.1)],
    p90: prices[Math.floor(n * 0.9)],
    minKey: entries.reduce((a, b) => b[1] < a[1] ? b : a)[0],
    maxKey: entries.reduce((a, b) => b[1] > a[1] ? b : a)[0],
  }
}

function buildMonthlyAvg(map) {
  const b = Array.from({ length: 12 }, () => ({ sum: 0, n: 0 }))
  if (map) for (const [k, p] of map) { const m = parseInt(k.slice(5, 7)) - 1; if (m >= 0 && m < 12) { b[m].sum += p; b[m].n++ } }
  return b.map((v, i) => ({ idx: i, avg: v.n > 0 ? v.sum / v.n : null }))
}

function buildHourlyAvg(map) {
  const b = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }))
  if (map) for (const [k, p] of map) { const h = parseInt(k.slice(11, 13)); if (h >= 0 && h < 24) { b[h].sum += p; b[h].n++ } }
  return b.map((v, i) => ({ hour: String(i).padStart(2, '0'), avg: v.n > 0 ? v.sum / v.n : null }))
}

function buildHistogram(map) {
  if (!map || map.size === 0) return []
  const prices = Array.from(map.values())
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const N = 24
  const size = max > min ? (max - min) / N : 1
  const counts = Array(N).fill(0)
  for (const p of prices) counts[Math.min(N - 1, Math.floor((p - min) / size))]++
  return counts.map((count, i) => ({
    label: `€${(min + i * size).toFixed(2)}`,
    midPrice: min + (i + 0.5) * size,
    count,
  }))
}

function priceColor(price, minP, maxP) {
  if (!isFinite(price) || maxP <= minP) return '#10b981'
  const t = Math.max(0, Math.min(1, (price - minP) / (maxP - minP)))
  if (t < 0.5) {
    const s = t * 2
    return `rgb(${Math.round(16 + s * 229)},${Math.round(185 - s * 27)},${Math.round(129 - s * 118)})`
  }
  const s = (t - 0.5) * 2
  return `rgb(${Math.round(245 - s * 6)},${Math.round(158 - s * 90)},${Math.round(11 + s * 57)})`
}

function fmtP(p) { return isFinite(p) ? `€${p.toFixed(3)}` : '—' }

function fmtKey(key) {
  if (!key) return '—'
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${key.slice(8, 10)} ${MO[parseInt(key.slice(5, 7)) - 1]} ${key.slice(0, 4)} ${key.slice(11, 13)}:00`
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-800">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5 font-mono">{sub}</div>}
    </div>
  )
}

function PriceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 shadow text-xs">
      <p className="font-medium text-gray-700 mb-0.5">{label}</p>
      {payload[0].value != null && <p className="text-gray-600">{fmtP(payload[0].value)}/kWh</p>}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function PricesPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const { stats, loading: statsLoading } = useEnergyStats(user?.uid)
  const { priceConfig, setPriceConfig, loadingPrices, priceError, retryLoadPrices } = usePriceConfig()

  // Seed date range from energy stats once known
  useEffect(() => {
    if (!stats?.firstMonthId || !stats?.lastMonthId || priceConfig.fromDate) return
    const from = stats.firstMonthId + '-01'
    const [y, m] = stats.lastMonthId.split('-').map(Number)
    const to = `${stats.lastMonthId}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
    setPriceConfig(prev => ({ ...prev, fromDate: from, toDate: to }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats?.firstMonthId, stats?.lastMonthId])

  const priceStats = useMemo(() => computeStats(priceConfig.hourlyPriceMap), [priceConfig.hourlyPriceMap])

  const monthlyData = useMemo(() => {
    const raw = buildMonthlyAvg(priceConfig.hourlyPriceMap)
    return raw.map((d, i) => ({ ...d, label: t(MONTHS[i]) }))
  }, [priceConfig.hourlyPriceMap, t])

  const hourlyData = useMemo(() => buildHourlyAvg(priceConfig.hourlyPriceMap), [priceConfig.hourlyPriceMap])
  const histogram = useMemo(() => buildHistogram(priceConfig.hourlyPriceMap), [priceConfig.hourlyPriceMap])

  const minP = priceStats?.min ?? 0
  const maxP = priceStats?.max ?? 1

  if (statsLoading) return <div className="text-sm text-gray-400">{t('loading')}</div>

  if (!stats || stats.months === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-gray-500 text-sm">{t('pricesNoData')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Config card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">💶 {t('pricesTitle')}</h2>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('priceCountry')}</label>
            <select
              value={priceConfig.country || 'NL'}
              onChange={e => setPriceConfig(prev => ({ ...prev, country: e.target.value, hourlyPriceMap: null }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="NL">{t('priceNL')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('fromDate')}</label>
            <input
              type="date"
              value={priceConfig.fromDate}
              onChange={e => setPriceConfig(prev => ({ ...prev, fromDate: e.target.value, hourlyPriceMap: null }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('toDate')}</label>
            <input
              type="date"
              value={priceConfig.toDate}
              onChange={e => setPriceConfig(prev => ({ ...prev, toDate: e.target.value, hourlyPriceMap: null }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Feed-in tariff */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('priceFeedin')}</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">€</span>
            <input
              type="number"
              min="0"
              max="5"
              step="0.01"
              value={priceConfig.sellPrice ?? 0.10}
              onChange={e => setPriceConfig(prev => ({ ...prev, sellPrice: parseFloat(e.target.value) }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Status */}
        {loadingPrices && <p className="text-sm text-blue-600">⏳ {t('fetching')}</p>}
        {priceError && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-amber-700">⚠️ {t('fetchFailed')}{priceError ? `: ${priceError}` : ''}</p>
            <button onClick={retryLoadPrices} className="text-xs text-blue-600 underline">
              {t('priceRetry')}
            </button>
          </div>
        )}
        {!loadingPrices && !priceError && priceConfig.hourlyPriceMap && (
          <p className="text-sm text-green-700">
            ✅ {priceConfig.hourlyPriceMap.size.toLocaleString('nl-NL')} {t('fetchSuccess')}
          </p>
        )}
      </div>

      {/* Stats + charts */}
      {priceStats && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={`🟢 ${t('priceMin')}`}
              value={`${fmtP(priceStats.min)}/kWh`}
              sub={fmtKey(priceStats.minKey)}
            />
            <StatCard
              label={`🔴 ${t('priceMax')}`}
              value={`${fmtP(priceStats.max)}/kWh`}
              sub={fmtKey(priceStats.maxKey)}
            />
            <StatCard label={t('priceAvg')} value={`${fmtP(priceStats.avg)}/kWh`} />
            <StatCard label={t('priceMedian')} value={`${fmtP(priceStats.median)}/kWh`} />
          </div>

          {/* Percentile band */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 flex flex-wrap gap-6">
            <span>🟢 {t('priceP10')}: ≤ {fmtP(priceStats.p10)}/kWh</span>
            <span>🔴 {t('priceP90')}: ≥ {fmtP(priceStats.p90)}/kWh</span>
            <span className="text-gray-400">{priceStats.count.toLocaleString('nl-NL')} {t('priceHours')}</span>
          </div>

          {/* Monthly + Hourly charts */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">{t('priceByMonth')}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} width={58} tickFormatter={v => `€${v.toFixed(2)}`} />
                  <Tooltip content={<PriceTooltip />} />
                  <Bar dataKey="avg" radius={[3, 3, 0, 0]}>
                    {monthlyData.map((d, i) => (
                      <Cell key={i} fill={priceColor(d.avg, minP, maxP)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">{t('priceByHour')}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fontSize: 10 }} width={58} tickFormatter={v => `€${v.toFixed(2)}`} />
                  <Tooltip content={<PriceTooltip />} />
                  <Bar dataKey="avg" radius={[3, 3, 0, 0]}>
                    {hourlyData.map((d, i) => (
                      <Cell key={i} fill={priceColor(d.avg, minP, maxP)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Price distribution histogram */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">{t('priceDistribution')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={histogram} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} width={55} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-2 shadow text-xs">
                      <p className="font-medium text-gray-700">{label}</p>
                      <p className="text-gray-600">{payload[0].value} {t('priceHours')}</p>
                    </div>
                  )
                }} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {histogram.map((d, i) => (
                    <Cell key={i} fill={priceColor(d.midPrice, minP, maxP)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
