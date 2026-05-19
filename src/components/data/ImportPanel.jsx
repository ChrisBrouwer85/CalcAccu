import { useState } from 'react'
import CSVImport from '../CSVImport.jsx'
import HAImport from '../HAImport.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../context/LangContext.jsx'
import { saveEnergyData } from '../../services/firestoreData.js'
import { invalidateEnergyCache } from '../../hooks/useEnergyData.js'

export default function ImportPanel({ onImported }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [activeTab, setActiveTab] = useState('csv')
  const [status, setStatus] = useState(null) // null | 'saving' | 'done' | 'error'
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const tabs = [
    { key: 'csv', label: t('csvTab'), icon: '📄' },
    { key: 'ha', label: t('haTab'), icon: '🏠' },
  ]

  async function handleData(rows) {
    if (!user) return
    setStatus('saving')
    setProgress({ done: 0, total: 0 })
    setResult(null)
    setError('')
    try {
      const summary = await saveEnergyData(user.uid, rows, activeTab, (done, total) => {
        setProgress({ done, total })
      })
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
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'csv' && <CSVImport t={t} onDataReady={handleData} disabled={status === 'saving'} />}
      {activeTab === 'ha' && <HAImport t={t} onDataReady={handleData} />}

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
