import { useState } from 'react'
import EnergyFlowChart from './EnergyFlowChart.jsx'
import SavingsChart from './SavingsChart.jsx'
import { MONTHS } from '../i18n.js'

function fmt(n, decimals = 0) {
  return isFinite(n) ? n.toFixed(decimals) : '—'
}
function fmtEur(n) {
  return isFinite(n) ? `€${Math.round(n).toLocaleString('nl-NL')}` : '—'
}

function SummaryCard({ size, result, t, costPerKwh, isBest }) {
  const { totals, financial } = result
  const savings = financial.annualSavings
  const totalCost = size * costPerKwh
  const payback = savings > 0 ? totalCost / savings : Infinity
  const selfSuffImprovement = totals.selfSufficiency - totals.baselineSelfSufficiency
  const importReduction = totals.baselineGridImport - totals.gridImport

  return (
    <div className={`relative bg-white rounded-2xl border-2 p-5 ${isBest ? 'border-green-400 shadow-lg' : 'border-gray-200'}`}>
      {isBest && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
          ⭐ {t('bestValue')}
        </span>
      )}
      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-gray-800">🔋 {size} kWh</div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-500">{t('annualSavings')}</span>
          <span className={`font-bold text-lg ${savings > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {fmtEur(savings)} / {t('years').replace('jaar','').replace('years','').trim() || 'yr'}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-500">{t('payback')}</span>
          <span className="font-semibold text-gray-700">
            {isFinite(payback) ? `${fmt(payback, 1)} ${t('years')}` : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-500">{t('selfSufficiency')}</span>
          <span className="font-semibold text-gray-700">
            {fmt(totals.selfSufficiency, 1)}%
            {selfSuffImprovement > 0 && (
              <span className="text-green-600 text-sm ml-1">(+{fmt(selfSuffImprovement, 1)}%)</span>
            )}
          </span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-gray-500">{t('gridImportReduction')}</span>
          <span className="font-semibold text-gray-700">{fmt(importReduction, 0)} kWh</span>
        </div>
      </div>
    </div>
  )
}

function MonthlyTable({ result, t }) {
  const months = result.monthly
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-left text-gray-600 font-medium">{t('month')}</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('solar')} (kWh)</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('gridImport')} (kWh)</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('gridExport')} (kWh)</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('batteryDischarge')} (kWh)</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('savings')}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-2 text-gray-700 font-medium">{t(MONTHS[i])}</td>
              <td className="px-4 py-2 text-right text-amber-700">{fmt(m.solar, 1)}</td>
              <td className="px-4 py-2 text-right text-red-600">{fmt(m.gridImport, 1)}</td>
              <td className="px-4 py-2 text-right text-blue-600">{fmt(m.gridExport, 1)}</td>
              <td className="px-4 py-2 text-right text-green-600">{fmt(m.batteryDischarge, 1)}</td>
              <td className={`px-4 py-2 text-right font-medium ${m.savings >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmtEur(m.savings)}
              </td>
            </tr>
          ))}
          <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
            <td className="px-4 py-2 text-gray-800">Totaal</td>
            <td className="px-4 py-2 text-right text-amber-700">{fmt(months.reduce((s,m)=>s+m.solar,0), 0)}</td>
            <td className="px-4 py-2 text-right text-red-600">{fmt(months.reduce((s,m)=>s+m.gridImport,0), 0)}</td>
            <td className="px-4 py-2 text-right text-blue-600">{fmt(months.reduce((s,m)=>s+m.gridExport,0), 0)}</td>
            <td className="px-4 py-2 text-right text-green-600">{fmt(months.reduce((s,m)=>s+m.batteryDischarge,0), 0)}</td>
            <td className="px-4 py-2 text-right text-green-700">{fmtEur(months.reduce((s,m)=>s+m.savings,0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function AnnualTable({ results, t, costPerKwh }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-left text-gray-600 font-medium">{t('batterySize')}</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('gridImport')} (kWh)</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('gridExport')} (kWh)</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('selfSufficiency')}</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('annualSavings')}</th>
            <th className="px-4 py-2 text-right text-gray-600 font-medium">{t('payback')}</th>
          </tr>
        </thead>
        <tbody>
          {results.map(({ sizeKwh, result }, i) => {
            const savings = result.financial.annualSavings
            const payback = savings > 0 ? (sizeKwh * costPerKwh) / savings : Infinity
            return (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 font-medium text-gray-800">🔋 {sizeKwh} kWh</td>
                <td className="px-4 py-2 text-right text-red-600">{fmt(result.totals.gridImport, 0)}</td>
                <td className="px-4 py-2 text-right text-blue-600">{fmt(result.totals.gridExport, 0)}</td>
                <td className="px-4 py-2 text-right text-gray-700">{fmt(result.totals.selfSufficiency, 1)}%</td>
                <td className={`px-4 py-2 text-right font-medium ${savings >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmtEur(savings)}
                </td>
                <td className="px-4 py-2 text-right text-gray-700">
                  {isFinite(payback) ? `${fmt(payback, 1)} ${t('years')}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function SimulationResults({ t, results, costPerKwh }) {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedResultIdx, setSelectedResultIdx] = useState(0)

  if (!results?.length) return null

  const bestIdx = results.reduce((best, r, i) =>
    r.result.financial.annualSavings > results[best].result.financial.annualSavings ? i : best, 0)

  const tabs = [
    { key: 'summary', label: t('summary') },
    { key: 'annual', label: t('annualTable') },
    { key: 'flow', label: t('flowChart') },
    { key: 'monthly', label: t('monthly') },
  ]

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {activeTab === 'summary' && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {results.map(({ sizeKwh, result }, i) => (
            <SummaryCard
              key={sizeKwh}
              size={sizeKwh}
              result={result}
              t={t}
              costPerKwh={costPerKwh}
              isBest={i === bestIdx}
            />
          ))}
        </div>
      )}

      {/* Annual comparison */}
      {activeTab === 'annual' && (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <AnnualTable results={results} t={t} costPerKwh={costPerKwh} />
          </div>
          <div className="mt-6">
            <h4 className="font-semibold text-gray-700 mb-3 text-sm">{t('savings')} vs. amortized cost (15yr)</h4>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SavingsChart t={t} results={results} costPerKwh={costPerKwh} />
            </div>
          </div>
        </div>
      )}

      {/* Energy flow */}
      {activeTab === 'flow' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">{t('selectSize')}:</span>
            <div className="flex gap-2">
              {results.map(({ sizeKwh }, i) => (
                <button
                  key={sizeKwh}
                  onClick={() => setSelectedResultIdx(i)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    selectedResultIdx === i
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {sizeKwh} kWh
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <EnergyFlowChart t={t} hourly={results[selectedResultIdx]?.result.hourly} />
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      {activeTab === 'monthly' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600">{t('selectSize')}:</span>
            <div className="flex gap-2">
              {results.map(({ sizeKwh }, i) => (
                <button
                  key={sizeKwh}
                  onClick={() => setSelectedResultIdx(i)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    selectedResultIdx === i
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {sizeKwh} kWh
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <MonthlyTable result={results[selectedResultIdx]?.result} t={t} />
          </div>
        </div>
      )}
    </div>
  )
}
