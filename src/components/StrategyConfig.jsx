export default function StrategyConfig({ t, strategy, onChange, hasHourlyPrices }) {
  const sellFraction = strategy.sellFraction ?? 0.5
  const allowGridCharge = strategy.allowGridCharge ?? false

  const sellFractionPct = Math.round(sellFraction * 100)
  const reservePct = 100 - sellFractionPct

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">{t('strategyTitle')}</h3>
        <p className="text-sm text-gray-500">{t('emsSmartDesc')}</p>
      </div>

      {/* No prices warning */}
      {!hasHourlyPrices && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          ⚠️ {t('emsNeedsPrices')}
        </div>
      )}

      {/* Sell fraction slider */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>🏠 0% {t('emsSell')}</span>
          <span>📈 100% {t('emsSell')}</span>
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
  )
}
