export default function StrategyConfig({ lang, t, strategy, onChange, hasHourlyPrices }) {
  const mode = strategy.mode ?? 'fixed'
  const homePriority = strategy.homePriority ?? 0.8
  const sellFraction = strategy.sellFraction ?? 0.5
  const allowGridCharge = strategy.allowGridCharge ?? false

  const pct = Math.round(homePriority * 100)
  const sellPct = 100 - pct
  const sellFractionPct = Math.round(sellFraction * 100)
  const reservePct = 100 - sellFractionPct

  function setMode(m) { onChange({ ...strategy, mode: m }) }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">{t('strategyTitle')}</h3>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
        {[
          { value: 'fixed', label: `⚖️ ${t('emsFixed')}` },
          { value: 'smart', label: `🤖 ${t('emsSmart')}` },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`flex-1 py-2 px-3 font-medium transition-colors ${
              mode === value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Fixed mode */}
      {mode === 'fixed' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t('strategyDesc')}</p>

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

          <div>
            <input
              type="range"
              min="0"
              max="100"
              value={pct}
              onChange={e => onChange({ ...strategy, homePriority: parseInt(e.target.value) / 100 })}
              className="w-full accent-green-500 h-2"
            />
            <div className="mt-2 text-center text-sm text-gray-700">
              <span className="font-medium text-green-700">{pct}%</span>{' '}
              {t('homeUsePct')} /{' '}
              <span className="font-medium text-blue-700">{sellPct}%</span>{' '}
              {t('sellPriority').toLowerCase()}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-2">
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
      )}

      {/* Smart EMS mode */}
      {mode === 'smart' && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">{t('emsSmartDesc')}</p>

          {/* No prices warning */}
          {!hasHourlyPrices && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              ⚠️ {t('emsNeedsPrices')}
            </div>
          )}

          {/* Sell fraction slider */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>🏠 0% {lang === 'nl' ? 'verkoop' : 'sell'}</span>
              <span>📈 100% {lang === 'nl' ? 'verkoop' : 'sell'}</span>
            </div>

            {/* Visual bar */}
            <div className="flex rounded-full overflow-hidden h-6 text-xs font-medium mb-1">
              {reservePct > 0 && (
                <div
                  className="bg-green-500 flex items-center justify-center text-white transition-all"
                  style={{ width: `${reservePct}%` }}
                >
                  {reservePct >= 15 ? `${reservePct}%` : ''}
                </div>
              )}
              {sellFractionPct > 0 && (
                <div
                  className="bg-blue-500 flex items-center justify-center text-white transition-all"
                  style={{ width: `${sellFractionPct}%` }}
                >
                  {sellFractionPct >= 15 ? `${sellFractionPct}%` : ''}
                </div>
              )}
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={sellFractionPct}
              onChange={e => onChange({ ...strategy, sellFraction: parseInt(e.target.value) / 100 })}
              className="w-full accent-blue-500 h-2"
            />

            <div className="mt-2 text-center text-sm text-gray-700 space-y-0.5">
              <div>
                <span className="font-medium text-blue-700">{sellFractionPct}%</span>{' '}
                {t('emsSellPct')}
              </div>
              <div className="text-xs text-gray-500">
                <span className="font-medium text-green-700">{reservePct}%</span>{' '}
                {t('emsReservePct')}
              </div>
            </div>
          </div>

          {/* Grid charge toggle */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowGridCharge}
              onChange={e => onChange({ ...strategy, allowGridCharge: e.target.checked })}
              className="mt-0.5 accent-blue-600 w-4 h-4 shrink-0"
            />
            <span className="text-sm text-gray-700">{t('emsGridCharge')}</span>
          </label>
        </div>
      )}
    </div>
  )
}
