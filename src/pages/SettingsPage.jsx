import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import { useEnergyStats } from '../hooks/useEnergyStats.js'
import AccountSection from '../components/settings/AccountSection.jsx'
import DefaultsSection from '../components/settings/DefaultsSection.jsx'
import DangerZone from '../components/settings/DangerZone.jsx'

export default function SettingsPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const { stats, reload } = useEnergyStats(user?.uid)

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{t('settingsAccount')}</h2>
        <AccountSection />
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{t('settingsDefaults')}</h2>
        <DefaultsSection />
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{t('settingsDanger')}</h2>
        <DangerZone stats={stats} onCleared={reload} />
      </section>
    </div>
  )
}
