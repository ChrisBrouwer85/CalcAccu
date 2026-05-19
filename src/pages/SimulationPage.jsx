import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import { useEnergyStats } from '../hooks/useEnergyStats.js'
import { useEnergyData } from '../hooks/useEnergyData.js'
import { getPreferences } from '../services/preferences.js'
import { runSimulation } from '../utils/simulation.js'
import { getStaticPricesForYear, getStaticPriceMap } from '../utils/energyPrices.js'
import SimulationControls from '../components/sim/SimulationControls.jsx'
import SimulationResults from '../components/SimulationResults.jsx'

export default function SimulationPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const { stats, loading: statsLoading } = useEnergyStats(user?.uid)

  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [accuConfig, setAccuConfig] = useState({
    selectedSizes: [5, 10],
    customSize: '',
    efficiency: 0.95,
    maxRateKw: 5,
    costPerKwh: 500,
  })
  const [homePriority, setHomePriority] = useState(0.8)
  const [priceConfig, setPriceConfig] = useState({
    source: 'static',
    selectedYear: '2024',
    buyPrice: 0.29,
    sellPrice: 0.10,
    fromDate: '',
    toDate: '',
    hourlyPriceMap: null,
  })
  const [sensorTariffs, setSensorTariffs] = useState({})

  const [monthRange, setMonthRange] = useState({ fromMonth: '', toMonth: '' })

  // Seed configs from preferences (once per user)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    getPreferences(user.uid).then(prefs => {
      if (cancelled) return
      setAccuConfig(prev => ({ ...prev, ...prefs.defaults.accuConfig }))
      setHomePriority(prefs.defaults.homePriority)
      setPriceConfig(prev => ({ ...prev, ...prefs.defaults.priceConfig }))
      setSensorTariffs(prefs.sensorTariffs ?? {})
      setPrefsLoaded(true)
    }).catch(() => setPrefsLoaded(true))
    return () => { cancelled = true }
  }, [user])

  // Seed range from available data
  useEffect(() => {
    if (stats?.firstMonthId && stats?.lastMonthId && !monthRange.fromMonth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMonthRange({ fromMonth: stats.firstMonthId, toMonth: stats.lastMonthId })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats?.firstMonthId, stats?.lastMonthId])

  const effectiveRange = useMemo(() => {
    if (!monthRange.fromMonth || !monthRange.toMonth) return null
    const [from, to] = monthRange.fromMonth <= monthRange.toMonth
      ? [monthRange.fromMonth, monthRange.toMonth]
      : [monthRange.toMonth, monthRange.fromMonth]
    return { fromMonth: from, toMonth: to }
  }, [monthRange])

  const { data: energyData, loading: dataLoading } = useEnergyData(user?.uid, effectiveRange)

  const dataDateRange = useMemo(() => {
    if (!energyData || energyData.length === 0) return null
    const first = energyData[0].timestamp
    const last = energyData[energyData.length - 1].timestamp
    return {
      from: first.toISOString().slice(0, 10),
      to: last.toISOString().slice(0, 10),
    }
  }, [energyData])

  const simulationResults = useMemo(() => {
    if (!energyData || energyData.length === 0) return null
    const allSizes = [
      ...accuConfig.selectedSizes,
      accuConfig.customSize ? parseFloat(accuConfig.customSize) : null,
    ].filter(s => s && isFinite(s))
    if (allSizes.length === 0) return null

    let priceMap = null
    let sellPrice = priceConfig.sellPrice
    if (priceConfig.source === 'api' && priceConfig.hourlyPriceMap) {
      priceMap = priceConfig.hourlyPriceMap
    } else {
      const yr = parseInt(priceConfig.selectedYear) || 2024
      const staticPrices = getStaticPricesForYear(yr)
      const buyPrice = priceConfig.source === 'manual' ? priceConfig.buyPrice : staticPrices.buy
      sellPrice = priceConfig.source === 'manual' ? priceConfig.sellPrice : staticPrices.sell
      priceMap = getStaticPriceMap(energyData, buyPrice)
    }

    return allSizes.map(size => ({
      sizeKwh: size,
      result: runSimulation(
        energyData,
        {
          capacityKwh: size,
          chargeEfficiency: accuConfig.efficiency,
          dischargeEfficiency: accuConfig.efficiency,
          maxChargeRateKw: accuConfig.maxRateKw,
          maxDischargeRateKw: accuConfig.maxRateKw,
        },
        { homePriority },
        priceMap,
        sellPrice,
        sensorTariffs,
      ),
    }))
  }, [energyData, accuConfig, homePriority, priceConfig, sensorTariffs])

  if (statsLoading || !prefsLoaded) {
    return <div className="text-sm text-gray-400">{t('loading')}</div>
  }

  if (!stats || stats.months === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="text-4xl mb-3">📭</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">{t('simNoData')}</h2>
        <Link
          to="/data"
          className="inline-block mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          {t('goToData')} →
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 sm:gap-6 min-w-0">
      <aside className="min-w-0">
        <SimulationControls
          monthRange={monthRange}
          setMonthRange={setMonthRange}
          availableRange={stats}
          accuConfig={accuConfig}
          setAccuConfig={setAccuConfig}
          homePriority={homePriority}
          setHomePriority={setHomePriority}
          priceConfig={priceConfig}
          setPriceConfig={setPriceConfig}
          dataDateRange={dataDateRange}
        />
      </aside>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 min-w-0">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">🎯 {t('results')}</h2>
          {dataLoading && <span className="text-xs text-gray-400 shrink-0">{t('recomputing')}…</span>}
        </div>
        {!simulationResults ? (
          <div className="text-sm text-gray-500">
            {dataLoading ? t('loading') : t('noResultsYet')}
          </div>
        ) : (
          <SimulationResults
            t={t}
            results={simulationResults}
            costPerKwh={accuConfig.costPerKwh}
          />
        )}
      </section>
    </div>
  )
}
