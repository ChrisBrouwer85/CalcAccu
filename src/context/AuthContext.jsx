import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase.js'
import { cleanupLegacySimulations } from '../services/firestoreData.js'
import { getPreferences, savePreferences } from '../services/preferences.js'

const AuthContext = createContext({ user: undefined })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  // One-shot legacy cleanup on first sign-in post-refactor
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const prefs = await getPreferences(user.uid)
        if (prefs.legacyCleanedAt) return
        if (cancelled) return
        await cleanupLegacySimulations(user.uid)
        await savePreferences(user.uid, { legacyCleanedAt: new Date().toISOString() })
      } catch {
        // swallow — non-critical
      }
    })()
    return () => { cancelled = true }
  }, [user])

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
