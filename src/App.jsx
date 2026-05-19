import { useState, useMemo, useEffect } from 'react'
import { translations } from './i18n.js'
import ImportData from './components/ImportData.jsx'
import AccuConfig from './components/AccuConfig.jsx'
import StrategyConfig from './components/StrategyConfig.jsx'
import PriceConfig from './components/PriceConfig.jsx'
import SimulationResults from './components/SimulationResults.jsx'
import SavedSimulations from './components/SavedSimulations.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import { auth, firebaseConfigured } from './firebase.js'
import { onAuthStateChanged } from 'firebase/auth'
import { runSimulation } from './utils/simulation.js'
import { getStaticPricesForYear, getStaticPriceMap, DUTCH_PRICE_HISTORY } from './utils/energyPrices.js'
import {
  loadHourlyData, saveHourlyData,
  loadSavedSimulations, saveSimulation, deleteSavedSimulation,
  serializePriceConfig, deserializePriceConfig, serializeSimResults,
  generateSimName,
} from './utils/storage.js'

const STEPS = [1, 2, 3, 4]

const AVATAR_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f97316','#ec4899','#14b8a6']

function getAvatarBg(name) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function UserAvatar({ user }) {
  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName || user.email}
        title={user.displayName || user.email}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        referrerPolicy="no-referrer"
      />
    )
  }
  const name = user.displayName || user.email?.split('@')[0] || '?'
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold select-none shrink-0"
      style={{ backgroundColor: getAvatarBg(name) }}
      title={user.displayName || user.email}
    >
      {getInitials(name)}
    </div>
  )
}

export default function App() {
  const [lang, setLang] = useState('en')
  const t = (key) => translations[lang][key] ?? translations.en[key] ?? key

  const [user, setUser] = useState(() => firebaseConfigured ? undefined : null)

  useEffect(() => {
    if (!firebaseConfigured) return
    return onAuthStateChanged(auth, firebaseUser => setUser(firebaseUser ?? null))
  }, [])

  const [activeStep, setActiveStep] = useState(1)
  const [hourlyData, setHourlyData] = useState([])

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

  const [simulationResults, setSimulationResults] = useState(null)
  const [savedSims, setSavedSims] = useState(() => loadSavedSimulations())

  const dataDateRange = useMemo(() => {
    if (!hourlyData.length) return null
    const timestamps = hourlyData.map(r => new Date(r.timestamp).getTime()).filter(isFinite)
    const from = new Date(Math.min(...timestamps)).toISOString().slice(0, 10)
    const to = new Date(Math.max(...timestamps)).toISOString().slice(0, 10)
    return { from, to }
  }, [hourlyData])

  function handleDataReady(data, tariffs = {}) {
    setHourlyData(data)
    setSensorTariffs(tariffs)
    const yr = String(new Date(data[0]?.timestamp).getFullYear())
    const prices = DUTCH_PRICE_HISTORY[yr] || { buy: 0.27, sell: 0.09 }
    setPriceConfig(c => ({ ...c, selectedYear: yr, buyPrice: prices.buy, sellPrice: prices.sell }))
    setActiveStep(2)
  }

  function canProceed(step) {
    if (step === 1) return hourlyData.length > 0
    if (step === 2) return accuConfig.selectedSizes.length > 0 || accuConfig.customSize
    return true
  }

  function buildPriceMap(data, cfg) {
    if (cfg.source === 'api' && cfg.hourlyPriceMap) {
      return { priceMap: cfg.hourlyPriceMap, sellPrice: cfg.sellPrice }
    }
    const yr = parseInt(cfg.selectedYear) || 2024
    const staticPrices = getStaticPricesForYear(yr)
    const buyPrice = cfg.source === 'manual' ? cfg.buyPrice : staticPrices.buy
    const sellPrice = cfg.source === 'manual' ? cfg.sellPrice : staticPrices.sell
    return { priceMap: getStaticPriceMap(data, buyPrice), sellPrice }
  }

  function handleCalculate() {
    const allSizes = [
      ...accuConfig.selectedSizes,
      accuConfig.customSize ? parseFloat(accuConfig.customSize) : null,
    ].filter(s => s && isFinite(s))
    const { priceMap, sellPrice } = buildPriceMap(hourlyData, priceConfig)
    const results = allSizes.map(size => ({
      sizeKwh: size,
      result: runSimulation(
        hourlyData,
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

    setSimulationResults(results)
    setActiveStep('results')

    saveHourlyData(hourlyData)
    const now = new Date()
    const sim = {
      id: String(now.getTime()),
      name: generateSimName(now),
      savedAt: now.toISOString(),
      accuConfig,
      priceConfig: serializePriceConfig(priceConfig),
      homePriority,
      simulationResults: serializeSimResults(results),
    }
    const updated = saveSimulation(sim)
    setSavedSims(updated)
  }

  function handleLoadSim(sim) {
    const stored = loadHourlyData()
    if (!stored || stored.length === 0) {
      alert(t('savedSimNoData'))
      return
    }
    const restoredPriceConfig = deserializePriceConfig(sim.priceConfig)
    setHourlyData(stored)
    setAccuConfig(sim.accuConfig)
    setHomePriority(sim.homePriority)
    setPriceConfig(restoredPriceConfig)
    const { priceMap, sellPrice } = buildPriceMap(stored, restoredPriceConfig)
    const allSizes = [
      ...sim.accuConfig.selectedSizes,
      sim.accuConfig.customSize ? parseFloat(sim.accuConfig.customSize) : null,
    ].filter(s => s && isFinite(s))
    const results = allSizes.map(size => ({
      sizeKwh: size,
      result: runSimulation(
        stored,
        {
          capacityKwh: size,
          chargeEfficiency: sim.accuConfig.efficiency,
          dischargeEfficiency: sim.accuConfig.efficiency,
          maxChargeRateKw: sim.accuConfig.maxRateKw,
          maxDischargeRateKw: sim.accuConfig.maxRateKw,
        },
        { homePriority: sim.homePriority },
        priceMap,
        sellPrice,
      ),
    }))
    setSimulationResults(results)
    setActiveStep('results')
  }

  function handleDeleteSim(id) {
    const updated = deleteSavedSimulation(id)
    setSavedSims(updated)
  }

  const stepLabels = [t('step1'), t('step2'), t('step3'), t('step4')]

  function resetApp() {
    setActiveStep(1)
    setHourlyData([])
    setSimulationResults(null)
    setSensorTariffs({})
  }

  if (!firebaseConfigured) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 w-full max-w-sm text-center">
        <span className="text-4xl mb-4 block">⚙️</span>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Firebase not configured</h2>
        <p className="text-sm text-gray-500">
          Set the <code className="bg-gray-100 px-1 rounded">VITE_FIREBASE_*</code> environment
          variables and rebuild the app.
        </p>
      </div>
    </div>
  )

  if (user === undefined) return null
  if (!user) return <LoginScreen t={t} lang={lang} setLang={setLang} />

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔋</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-none">{t('appTitle')}</h1>
              <p className="text-xs text-gray-500">{t('appSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {['en', 'nl'].map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    lang === l ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <SavedSimulations
              t={t}
              savedSims={savedSims}
              onLoad={handleLoadSim}
              onDelete={handleDeleteSim}
              onNewImport={simulationResults ? resetApp : null}
            />
            <UserAvatar user={user} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Step indicator */}
        {activeStep !== 'results' && (
          <div className="flex items-center mb-8">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <button
                  onClick={() => hourlyData.length > 0 && step <= activeStep && setActiveStep(step)}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
                    activeStep === step
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : step < activeStep
                      ? 'bg-green-500 text-white cursor-pointer'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {step < activeStep ? '✓' : step}
                </button>
                <span className={`ml-2 text-sm font-medium hidden sm:block ${
                  activeStep === step ? 'text-blue-700' : step < activeStep ? 'text-green-700' : 'text-gray-400'
                }`}>
                  {stepLabels[i]}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 ${step < activeStep ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {activeStep === 1 && (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. {t('step1')}</h2>
              <ImportData
                lang={lang}
                t={t}
                onDataReady={handleDataReady}
                defaultBuyPrice={priceConfig.buyPrice}
                defaultSellPrice={priceConfig.sellPrice}
              />
            </>
          )}

          {activeStep === 2 && (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-4">2. {t('step2')}</h2>
              <AccuConfig t={t} config={accuConfig} onChange={setAccuConfig} />
            </>
          )}

          {activeStep === 3 && (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-4">3. {t('step3')}</h2>
              <StrategyConfig lang={lang} t={t} homePriority={homePriority} onChange={setHomePriority} />
            </>
          )}

          {activeStep === 4 && (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-4">4. {t('step4')}</h2>
              <PriceConfig
                t={t}
                config={priceConfig}
                onChange={setPriceConfig}
                dataDateRange={dataDateRange}
              />
            </>
          )}

          {activeStep === 'results' && (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-4">🎯 {t('results')}</h2>
              <SimulationResults
                t={t}
                results={simulationResults}
                costPerKwh={accuConfig.costPerKwh}
              />
            </>
          )}
        </div>

        {/* Navigation buttons */}
        {activeStep !== 'results' && (
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setActiveStep(s => Math.max(1, typeof s === 'number' ? s - 1 : 4))}
              disabled={activeStep === 1}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← {t('back')}
            </button>

            {activeStep < 4 ? (
              <button
                onClick={() => setActiveStep(s => typeof s === 'number' ? s + 1 : s)}
                disabled={!canProceed(activeStep)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('next')} →
              </button>
            ) : (
              <button
                onClick={handleCalculate}
                className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors"
              >
                ⚡ {t('calculate')}
              </button>
            )}
          </div>
        )}

        {activeStep === 'results' && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setActiveStep(4)}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              ← {t('back')}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
