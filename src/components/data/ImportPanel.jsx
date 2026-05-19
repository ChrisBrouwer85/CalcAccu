import { useEffect, useState } from 'react'
import ImportData from '../ImportData.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../context/LangContext.jsx'
import { saveEnergyData } from '../../services/firestoreData.js'
import { getPreferences, savePreferences } from '../../services/preferences.js'
import { invalidateEnergyCache } from '../../hooks/useEnergyData.js'

export default function ImportPanel({ onImported }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [status, setStatus] = useState(null) // null | 'saving' | 'done' | 'error'
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [defaults, setDefaults] = useState({ buyPrice: 0.29, sellPrice: 0.10 })

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getPreferences(user.uid).then(prefs => {
      if (cancelled) return
      setDefaults({
        buyPrice: prefs.defaults.priceConfig.buyPrice,
        sellPrice: prefs.defaults.priceConfig.sellPrice,
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user])

  async function handleData(rows, sensorTariffs) {
    if (!user) return
    setStatus('saving')
    setProgress({ done: 0, total: 0 })
    setResult(null)
    setError('')
    try {
      const summary = await saveEnergyData(user.uid, rows, 'import', (done, total) => {
        setProgress({ done, total })
      })
      // Merge sensor tariffs into the user's settings doc
      if (sensorTariffs && Object.keys(sensorTariffs).length > 0) {
        const prefs = await getPreferences(user.uid)
        await savePreferences(user.uid, {
          sensorTariffs: { ...prefs.sensorTariffs, ...sensorTariffs },
        })
      }
      invalidateEnergyCache(user.uid)
      setResult({ ...summary, rows: rows.length })
      setStatus('done')
      onImported?.()
    } catch (e) {
      setError(e.message ?? String(e))
      setStatus('error')
    }
  }

  return (
    <div className="space-y-5">
      <ImportData
        t={t}
        onDataReady={handleData}
        defaultBuyPrice={defaults.buyPrice}
        defaultSellPrice={defaults.sellPrice}
      />

      {status === 'saving' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          {t('importingProgress')}
          {progress.total > 0 && ` ${progress.done}/${progress.total}`}
        </div>
      )}
      {status === 'done' && result && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          ✅ {result.hours} {t('importedHours')} ({result.months} {t('importedMonths')})
        </div>
      )}
      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
