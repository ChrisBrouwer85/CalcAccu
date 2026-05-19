import { useCallback, useEffect, useState } from 'react'
import { getEnergyStats } from '../services/firestoreData.js'

export function useEnergyStats(uid) {
  const [state, setState] = useState({ stats: null, loading: !!uid, error: null })

  const reload = useCallback(() => {
    if (!uid) {
      setState({ stats: null, loading: false, error: null })
      return Promise.resolve()
    }
    setState(s => ({ ...s, loading: true, error: null }))
    return getEnergyStats(uid)
      .then(stats => setState({ stats, loading: false, error: null }))
      .catch(error => setState({ stats: null, loading: false, error }))
  }, [uid])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
  }, [reload])

  return { ...state, reload }
}
