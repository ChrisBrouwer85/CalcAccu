import { useLang } from '../../context/LangContext.jsx'

function formatMonth(monthId, lang) {
  if (!monthId) return '—'
  const [y, m] = monthId.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US', {
    year: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

export default function DataOverview({ stats, loading }) {
  const { lang, t } = useLang()

  if (loading && !stats) {
    return (
      <div className="text-sm text-gray-400">{t('loading')}</div>
    )
  }

  if (!stats || stats.months === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-6 text-center">
        <div className="text-3xl mb-2">📭</div>
        <p className="text-sm text-gray-600">{t('noStoredData')}</p>
      </div>
    )
  }

  const sourceEntries = Object.entries(stats.sources)

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Stat label={t('totalHours')} value={stats.hours.toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US')} />
      <Stat label={t('dateRange')} value={`${formatMonth(stats.firstMonthId, lang)} → ${formatMonth(stats.lastMonthId, lang)}`} />
      <Stat
        label={t('sources')}
        value={sourceEntries.length === 0 ? '—' : sourceEntries.map(([s, n]) => `${s} (${n})`).join(' · ')}
      />
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-base font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  )
}
