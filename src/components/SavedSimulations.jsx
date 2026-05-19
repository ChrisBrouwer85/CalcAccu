import { useState, useRef, useEffect } from 'react'

export default function SavedSimulations({ t, savedSims, onLoad, onDelete, onNewImport }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function bestSavings(sim) {
    if (!sim.simulationResults?.length) return null
    return Math.max(...sim.simulationResults.map(r => r.result?.financial?.annualSavings ?? 0))
  }

  function allSizes(sim) {
    return [
      ...(sim.accuConfig?.selectedSizes ?? []),
      sim.accuConfig?.customSize ? parseFloat(sim.accuConfig.customSize) : null,
    ].filter(s => s && isFinite(s))
  }

  const sorted = [...savedSims].sort((a, b) => b.savedAt.localeCompare(a.savedAt))

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100"
      >
        {t('savedSimsButton')}
        {savedSims.length > 0 && (
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
            {savedSims.length}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="saved-sims-panel"
          className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto"
        >
          {onNewImport && (
            <div className="px-4 py-3 border-b border-gray-100">
              <button
                onClick={() => { onNewImport(); setOpen(false) }}
                className="w-full text-left text-sm text-gray-700 hover:text-gray-900 py-1"
              >
                {t('uploadAnother')}
              </button>
            </div>
          )}
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">{t('savedSimsTitle')}</h3>
          </div>

          {sorted.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">{t('savedSimsEmpty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sorted.map(sim => {
                const savings = bestSavings(sim)
                const sizes = allSizes(sim)
                return (
                  <li key={sim.id} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{sim.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {sizes.join(', ')} kWh
                          {sim.accuConfig?.efficiency != null && (
                            <> · {t('efficiency')} {Math.round(sim.accuConfig.efficiency * 100)}%</>
                          )}
                        </p>
                        {savings != null && (
                          <p className="text-xs font-semibold text-green-700 mt-0.5">
                            {t('savedSimBestSavings')}: €{Math.round(savings).toLocaleString('nl-NL')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => { onLoad(sim); setOpen(false) }}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg"
                        >
                          {t('savedSimLoad')}
                        </button>
                        <button
                          onClick={() => onDelete(sim.id)}
                          className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50"
                        >
                          {t('savedSimDelete')}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
