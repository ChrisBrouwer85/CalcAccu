import { useState } from 'react'
import AccuConfig from '../AccuConfig.jsx'
import StrategyConfig from '../StrategyConfig.jsx'
import { useLang } from '../../context/LangContext.jsx'
import { usePriceConfig } from '../../context/PriceContext.jsx'

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 sm:px-4 py-3 flex items-center justify-between text-left"
      >
        <span className="font-semibold text-gray-800 text-sm sm:text-base">{title}</span>
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="px-3 sm:px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function SimulationControls({
  monthRange,
  setMonthRange,
  availableRange,
  accuConfig,
  setAccuConfig,
  strategy,
  setStrategy,
}) {
  const { lang, t } = useLang()
  const { priceConfig } = usePriceConfig()
  const hasHourlyPrices = !!(priceConfig.hourlyPriceMap && priceConfig.hourlyPriceMap.size > 0)

  return (
    <div className="space-y-4">
      <Section title={`📅 ${t('simRange')}`}>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('fromMonth')}</label>
            <input
              type="month"
              value={monthRange.fromMonth}
              min={availableRange?.firstMonthId}
              max={availableRange?.lastMonthId}
              onChange={e => setMonthRange(r => ({ ...r, fromMonth: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('toMonth')}</label>
            <input
              type="month"
              value={monthRange.toMonth}
              min={availableRange?.firstMonthId}
              max={availableRange?.lastMonthId}
              onChange={e => setMonthRange(r => ({ ...r, toMonth: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
      </Section>

      <Section title={`🔋 ${t('configBattery')}`}>
        <AccuConfig t={t} config={accuConfig} onChange={setAccuConfig} />
      </Section>

      <Section title={`🤖 ${t('configStrategy')}`}>
        <StrategyConfig
          lang={lang}
          t={t}
          strategy={strategy}
          onChange={setStrategy}
          hasHourlyPrices={hasHourlyPrices}
        />
      </Section>
    </div>
  )
}
