import { createContext, useContext, useEffect, useState } from 'react'
import { translations } from '../i18n.js'
import { useAuth } from './AuthContext.jsx'
import { getPreferences, savePreferences } from '../services/preferences.js'

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k })

const STORAGE_KEY = 'calcaccu.lang'

function readInitial() {
  if (typeof window === 'undefined') return 'en'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'nl' || v === 'en' ? v : 'en'
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readInitial)
  const { user } = useAuth()

  // Pull lang from user preferences once signed in
  useEffect(() => {
    if (!user) return
    let cancelled = false
    getPreferences(user.uid).then(prefs => {
      if (cancelled) return
      if (prefs.lang && prefs.lang !== lang) {
        setLangState(prefs.lang)
        window.localStorage.setItem(STORAGE_KEY, prefs.lang)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function setLang(next) {
    setLangState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
    if (user) {
      savePreferences(user.uid, { lang: next }).catch(() => {})
    }
  }

  const t = (key) => translations[lang]?.[key] ?? translations.en[key] ?? key

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
  return useContext(LangContext)
}
