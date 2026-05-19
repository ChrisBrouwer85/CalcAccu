import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import { useEnergyStats } from '../hooks/useEnergyStats.js'
import DataOverview from '../components/data/DataOverview.jsx'
import ImportPanel from '../components/data/ImportPanel.jsx'
import ClearDataPanel from '../components/data/ClearDataPanel.jsx'

export default function DataPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const { stats, loading, reload } = useEnergyStats(user?.uid)

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{t('dataOverview')}</h2>
        <DataOverview stats={stats} loading={loading} />
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{t('importData')}</h2>
        <ImportPanel onImported={reload} />
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{t('manageData')}</h2>
        <ClearDataPanel stats={stats} onCleared={reload} />
      </section>
    </div>
  )
}
