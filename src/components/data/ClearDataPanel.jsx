import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../context/LangContext.jsx'
import { clearAllEnergyData, clearEnergyRange } from '../../services/firestoreData.js'
import { invalidateEnergyCache } from '../../hooks/useEnergyData.js'

export default function ClearDataPanel({ stats, onCleared }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [fromMonth, setFromMonth] = useState('')
  const [toMonth, setToMonth] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(null) // null | 'all' | 'range'
  const [error, setError] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stats?.firstMonthId && !fromMonth) setFromMonth(stats.firstMonthId)
    if (stats?.lastMonthId && !toMonth) setToMonth(stats.lastMonthId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats?.firstMonthId, stats?.lastMonthId])

  const noData = !stats || stats.months === 0

  async function doClearAll() {
    setBusy(true)
    setError('')
    try {
      await clearAllEnergyData(user.uid)
      invalidateEnergyCache(user.uid)
      onCleared?.()
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  async function doClearRange() {
    if (!fromMonth || !toMonth) return
    const [from, to] = fromMonth <= toMonth ? [fromMonth, toMonth] : [toMonth, fromMonth]
    setBusy(true)
    setError('')
    try {
      await clearEnergyRange(user.uid, from, to)
      invalidateEnergyCache(user.uid)
      onCleared?.()
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800">{t('clearRange')}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('fromMonth')}</label>
            <input
              type="month"
              value={fromMonth}
              onChange={e => setFromMonth(e.target.value)}
              disabled={noData || busy}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('toMonth')}</label>
            <input
              type="month"
              value={toMonth}
              onChange={e => setToMonth(e.target.value)}
              disabled={noData || busy}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        </div>
        {confirming === 'range' ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-700">{t('clearConfirm')}</span>
            <button
              onClick={doClearRange}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-50"
            >
              {t('confirmDelete')}
            </button>
            <button
              onClick={() => setConfirming(null)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs"
            >
              {t('cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming('range')}
            disabled={noData || busy || !fromMonth || !toMonth}
            className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            🗑️ {t('clearRange')}
          </button>
        )}
      </div>

      <div className="border-t border-gray-200 pt-5 space-y-3">
        <h3 className="font-semibold text-gray-800">{t('clearAll')}</h3>
        <p className="text-xs text-gray-500">{t('clearAllHint')}</p>
        {confirming === 'all' ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-700">{t('clearAllConfirm')}</span>
            <button
              onClick={doClearAll}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-50"
            >
              {t('confirmDelete')}
            </button>
            <button
              onClick={() => setConfirming(null)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs"
            >
              {t('cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming('all')}
            disabled={noData || busy}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            🗑️ {t('clearAll')}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}
