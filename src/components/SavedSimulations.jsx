import { useEffect, useState } from 'react'
import { collection, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase.js'

export default function SavedSimulations({ t, user, onLoad, onClose }) {
  const [simulations, setSimulations] = useState([])

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'users', user.uid, 'simulations'),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, snap => {
      setSimulations(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  async function handleDelete(id) {
    await deleteDoc(doc(db, 'users', user.uid, 'simulations', id))
  }

  function handleLoad(sim) {
    onLoad({
      accuConfig: sim.accuConfig,
      homePriority: sim.homePriority,
      priceConfig: sim.priceConfig,
      simulationResults: sim.results,
    })
    onClose()
  }

  function formatDate(ts) {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-30 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">{t('savedSimulations')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {simulations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">{t('noSaved')}</p>
          ) : (
            <ul className="space-y-3">
              {simulations.map(sim => (
                <li key={sim.id} className="border border-gray-200 rounded-xl p-3">
                  <div className="font-medium text-gray-800 text-sm truncate">{sim.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatDate(sim.createdAt)}</div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleLoad(sim)}
                      className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                    >
                      {t('loadSimulation')}
                    </button>
                    <button
                      onClick={() => handleDelete(sim.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-xs font-medium transition-colors"
                    >
                      {t('deleteSimulation')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
