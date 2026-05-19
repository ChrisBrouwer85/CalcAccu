import { useEffect, useState } from 'react'
import { getEnergyRange } from '../services/firestoreData.js'

// Module-level cache so navigation between Data ↔ Simulation pages doesn't refetch.
const cache = new Map()

export function invalidateEnergyCache(uid) {
  if (!uid) {
    cache.clear()
    return
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(uid + '|')) cache.delete(key)
  }
}

export function useEnergyData(uid, range) {
  const key = uid && range?.fromMonth && range?.toMonth
    ? `${uid}|${range.fromMonth}|${range.toMonth}`
    : null

  const [state, setState] = useState(() => ({
    data: key && cache.has(key) ? cache.get(key) : null,
    loading: !!key && !cache.has(key),
    error: null,
  }))

  useEffect(() => {
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: null, loading: false, error: null })
      return
    }
    if (cache.has(key)) {
      setState({ data: cache.get(key), loading: false, error: null })
      return
    }
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: null }))
    getEnergyRange(uid, range.fromMonth, range.toMonth)
      .then(rows => {
        if (cancelled) return
        cache.set(key, rows)
        setState({ data: rows, loading: false, error: null })
      })
      .catch(err => {
        if (cancelled) return
        setState({ data: null, loading: false, error: err })
      })
    return () => { cancelled = true }
  }, [key, uid, range?.fromMonth, range?.toMonth])

  return state
}
