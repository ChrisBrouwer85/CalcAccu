export default function StrategyConfig({ t, homePriority, onChange }) {
  const pct = Math.round(homePriority * 100)
  const sellPct = 100 - pct

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">{t('strategyTitle')}</h3>
        <p className="text-sm text-gray-500">{t('strategyDesc')}</p>
      </div>

      {/* Visual split bar */}
      <div className="flex rounded-full overflow-hidden h-6 text-xs font-medium">
        {pct > 0 && (
          <div
            className="bg-green-500 flex items-center justify-center text-white transition-all"
            style={{ width: `${pct}%` }}
          >
            {pct >= 15 ? `${pct}%` : ''}
          </div>
        )}
        {sellPct > 0 && (
          <div
            className="bg-blue-500 flex items-center justify-center text-white transition-all"
            style={{ width: `${sellPct}%` }}
          >
            {sellPct >= 15 ? `${sellPct}%` : ''}
          </div>
        )}
      </div>

      <div className="flex justify-between text-xs text-gray-500 -mt-3">
        <span>🏠 {t('homePriority')}</span>
        <span>{t('sellPriority')} 📈</span>
      </div>

      {/* Slider */}
      <div>
        <input
          type="range"
          min="0"
          max="100"
          value={pct}
          onChange={e => onChange(parseInt(e.target.value) / 100)}
          className="w-full accent-green-500 h-2"
        />
        <div className="mt-2 text-center text-sm text-gray-700">
          <span className="font-medium text-green-700">{pct}%</span>{' '}
          {t('homeUsePct')} /{' '}
          <span className="font-medium text-blue-700">{sellPct}%</span>{' '}
          {t('sellPriority').toLowerCase()}
        </div>
      </div>

      {/* Explanation cards */}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="font-semibold text-green-800 mb-1">🏠 {t('homePriority')}</div>
          <p className="text-sm text-green-700">
            {lang === 'nl'
              ? 'De accu laadt op met zonne-energie en ontlaadt om je verbruik te dekken. Minder van het net afnemen.'
              : 'The battery charges from solar and discharges to cover your consumption. Less grid import.'}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="font-semibold text-blue-800 mb-1">📈 {t('sellPriority')}</div>
          <p className="text-sm text-blue-700">
            {lang === 'nl'
              ? 'Meer zonne-energie gaat direct naar het net. De accu ontlaadt minder voor thuisgebruik.'
              : 'More solar production goes directly to the grid. Battery discharges less for home use.'}
          </p>
        </div>
      </div>
    </div>
  )
}
