import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../context/LangContext.jsx'
import { getPreferences, savePreferences, DEFAULT_PREFERENCES } from '../../services/preferences.js'
import AccuConfig from '../AccuConfig.jsx'
import StrategyConfig from '../StrategyConfig.jsx'

export default function DefaultsSection() {
  const { user } = useAuth()
  const { lang, t } = useLang()
  const [accuConfig, setAccuConfig] = useState(DEFAULT_PREFERENCES.defaults.accuConfig)
  const [strategy, setStrategy] = useState(DEFAULT_PREFERENCES.defaults.strategy)
  const [status, setStatus] = useState('') // '' | 'saving' | 'saved' | 'error'
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getPreferences(user.uid).then(prefs => {
      if (cancelled) return
      setAccuConfig(prefs.defaults.accuConfig)
      setStrategy(prefs.defaults.strategy)
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return () => { cancelled = true }
  }, [user])

  async function handleSave() {
    if (!user) return
    setStatus('saving')
    try {
      await savePreferences(user.uid, {
        defaults: { accuConfig, strategy },
      })
      setStatus('saved')
      setTimeout(() => setStatus(''), 2000)
    } catch {
      setStatus('error')
    }
  }

  if (!loaded) return <div className="text-sm text-gray-400">{t('loading')}</div>

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">{t('defaultsHint')}</p>

      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
        <h4 className="font-semibold text-gray-800 mb-3">🔋 {t('configBattery')}</h4>
        <AccuConfig t={t} config={accuConfig} onChange={setAccuConfig} />
      </div>

      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
        <h4 className="font-semibold text-gray-800 mb-3">⚖️ {t('configStrategy')}</h4>
        <StrategyConfig
          lang={lang}
          t={t}
          strategy={strategy}
          onChange={setStrategy}
          hasHourlyPrices={false}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
        >
          {status === 'saving' ? t('saving') : t('saveDefaults')}
        </button>
        {status === 'saved' && <span className="text-sm text-green-600 font-medium">✅ {t('defaultsSaved')}</span>}
        {status === 'error' && <span className="text-sm text-red-600">⚠️ {t('authError')}</span>}
      </div>
    </div>
  )
}
