import { useState } from 'react'

const PRESET_SIZES = [5, 10, 15, 20]
const DEFAULT_COSTS = { 5: 2000, 10: 3500, 15: 5000, 20: 6500 }

export default function AccuConfig({ t, config, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  function toggleSize(size) {
    const next = config.selectedSizes.includes(size)
      ? config.selectedSizes.filter(s => s !== size)
      : [...config.selectedSizes, size]
    onChange({ ...config, selectedSizes: next })
  }

  function updateField(field, value) {
    onChange({ ...config, [field]: value })
  }

  return (
    <div className="space-y-6">
      {/* Preset sizes */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">{t('accuSizes')}</h3>
        <div className="flex flex-wrap gap-3">
          {PRESET_SIZES.map(size => {
            const selected = config.selectedSizes.includes(size)
            return (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                className={`px-5 py-3 rounded-xl border-2 font-medium transition-all ${
                  selected
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                }`}
              >
                <div className="text-xl font-bold">{size} kWh</div>
                <div className="text-xs mt-0.5 opacity-70">
                  ≈ €{(DEFAULT_COSTS[size] ?? size * 400).toLocaleString()}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('customSize')}
        </label>
        <input
          type="number"
          min="1"
          max="200"
          step="0.5"
          placeholder="e.g. 13.5"
          value={config.customSize}
          onChange={e => updateField('customSize', e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-green-300"
        />
      </div>

      {/* Cost per kWh */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('costPerKwh')}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">€</span>
          <input
            type="number"
            min="100"
            max="2000"
            step="50"
            value={config.costPerKwh}
            onChange={e => updateField('costPerKwh', parseFloat(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <span className="text-gray-400 text-sm">/ kWh</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{t('accuCostDefaults')}</p>
      </div>

      {/* Advanced settings */}
      <div>
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          <span>{showAdvanced ? '▼' : '▶'}</span> {t('advancedSettings')}
        </button>
        {showAdvanced && (
          <div className="mt-4 grid gap-4 md:grid-cols-2 border border-gray-100 rounded-xl p-4 bg-gray-50">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('efficiency')} ({Math.round(config.efficiency * 100)}%)
              </label>
              <input
                type="range"
                min="70"
                max="99"
                value={Math.round(config.efficiency * 100)}
                onChange={e => updateField('efficiency', parseInt(e.target.value) / 100)}
                className="w-full accent-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('maxRate')}
              </label>
              <input
                type="number"
                min="1"
                max="22"
                step="0.1"
                value={config.maxRateKw}
                onChange={e => updateField('maxRateKw', parseFloat(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-300"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
