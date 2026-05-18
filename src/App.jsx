import { useState, useMemo, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import { translations } from './i18n.js'
import CSVImport from './components/CSVImport.jsx'
import AccuConfig from './components/AccuConfig.jsx'
import StrategyConfig from './components/StrategyConfig.jsx'
import PriceConfig from './components/PriceConfig.jsx'
import SimulationResults from './components/SimulationResults.jsx'
import AuthPage from './components/AuthPage.jsx'
import SavedSimulations from './components/SavedSimulations.jsx'
import { runSimulation } from './utils/simulation.js'
import { getStaticPricesForYear, getStaticPriceMap, DUTCH_PRICE_HISTORY } from './utils/energyPrices.js'

const STEPS = [1, 2, 3, 4]

export default function App() {
  const [lang, setLang] = useState('en')
  const t = (key) => translations[lang][key] ?? translations.en[key] ?? key

  const [user, setUser] = useState(undefined)
  const [showSaved, setShowSaved] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [saveName, setSaveName] = useState('')

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

  const [simulationResults, setSimulationResults] = useState(null)

  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])

  const dataDateRange = useMemo(() => {
    if (!hourlyData.length) return null
    const timestamps = hourlyData.map(r => new Date(r.timestamp).getTime()).filter(isFinite)
    const from = new Date(Math.min(...timestamps)).toISOString().slice(0, 10)
    const to = new Date(Math.max(...timestamps)).toISOString().slice(0, 10)
    return { from, to }
  }, [hourlyData])

  function handleDataReady(data) {
    setHourlyData(data)
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

  function handleCalculate() {
    const allSizes = [
      ...accuConfig.selectedSizes,
      accuConfig.customSize ? parseFloat(accuConfig.customSize) : null,
    ].filter(s => s && isFinite(s))

    let priceMap = null
    let sellPrice = priceConfig.sellPrice

    if (priceConfig.source === 'api' && priceConfig.hourlyPriceMap) {
      priceMap = priceConfig.hourlyPriceMap
      sellPrice = priceConfig.sellPrice
    } else {
      const yr = parseInt(priceConfig.selectedYear) || 2024
      const staticPrices = getStaticPricesForYear(yr)
      const buyPrice = priceConfig.source === 'manual' ? priceConfig.buyPrice : staticPrices.buy
      sellPrice = priceConfig.source === 'manual' ? priceConfig.sellPrice : staticPrices.sell
      priceMap = getStaticPriceMap(hourlyData, buyPrice)
    }

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
      ),
    }))

    setSimulationResults(results)
    setActiveStep('results')
    setSaveStatus(null)
    setShowSaveInput(false)
    setSaveName('')
  }

  async function handleSaveSimulation() {
    if (!saveName.trim() || !user) return
    setSaveStatus('saving')
    setShowSaveInput(false)
    try {
      // Strip hourly data — too large for Firestore and not needed for display
      const resultsToSave = simulationResults.map(({ sizeKwh, result }) => ({
        sizeKwh,
        result: { monthly: result.monthly, totals: result.totals, financial: result.financial },
      }))
      const { hourlyPriceMap: _omit, ...priceConfigToSave } = priceConfig
      await addDoc(collection(db, 'users', user.uid, 'simulations'), {
        name: saveName.trim(),
        createdAt: serverTimestamp(),
        accuConfig,
        homePriority,
        priceConfig: priceConfigToSave,
        results: resultsToSave,
      })
      setSaveStatus('saved')
      setSaveName('')
    } catch {
      setSaveStatus(null)
    }
  }

  function handleLoadSimulation({ accuConfig: ac, homePriority: hp, priceConfig: pc, simulationResults: sr }) {
    setAccuConfig(ac)
    setHomePriority(hp)
    setPriceConfig(prev => ({ ...prev, ...pc, hourlyPriceMap: null }))
    setSimulationResults(sr)
    setActiveStep('results')
    setSaveStatus(null)
    setShowSaveInput(false)
    setSaveName('')
  }

  const stepLabels = [t('step1'), t('step2'), t('step3'), t('step4')]

  function resetApp() {
    setActiveStep(1)
    setHourlyData([])
    setSimulationResults(null)
    setSaveStatus(null)
    setShowSaveInput(false)
    setSaveName('')
  }

  // Loading auth state
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  // Not authenticated
  if (user === null) {
    return <AuthPage t={t} lang={lang} setLang={setLang} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showSaved && (
        <SavedSimulations
          t={t}
          user={user}
          onLoad={handleLoadSimulation}
          onClose={() => setShowSaved(false)}
        />
      )}

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
            {simulationResults && (
              <button
                onClick={resetApp}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
              >
                {t('uploadAnother')}
              </button>
            )}
            <button
              onClick={() => setShowSaved(true)}
              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100 font-medium"
            >
              {t('savedSimulations')}
            </button>
            <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
              <span className="text-xs text-gray-500 max-w-32 truncate hidden sm:block">{user.email}</span>
              <button
                onClick={() => signOut(auth)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
              >
                {t('signOut')}
              </button>
            </div>
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
              <CSVImport lang={lang} t={t} onDataReady={handleDataReady} />
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
              <div className="flex items-start justify-between mb-4 gap-4">
                <h2 className="text-xl font-bold text-gray-800">🎯 {t('results')}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  {saveStatus === 'saved' ? (
                    <span className="text-sm text-green-600 font-medium">{t('saved')}</span>
                  ) : saveStatus === 'saving' ? (
                    <span className="text-sm text-gray-400">{t('saving')}</span>
                  ) : showSaveInput ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={saveName}
                        onChange={e => setSaveName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveSimulation(); if (e.key === 'Escape') { setShowSaveInput(false); setSaveName('') } }}
                        placeholder={t('simName')}
                        autoFocus
                        className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                      />
                      <button
                        onClick={handleSaveSimulation}
                        disabled={!saveName.trim()}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setShowSaveInput(false); setSaveName('') }}
                        className="px-2 py-1.5 rounded-lg text-gray-400 hover:text-gray-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveInput(true)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-medium transition-colors"
                    >
                      {t('saveSimulation')}
                    </button>
                  )}
                </div>
              </div>
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
