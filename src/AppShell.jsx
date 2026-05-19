import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase.js'
import { useAuth } from './context/AuthContext.jsx'
import { useLang } from './context/LangContext.jsx'

function navLinkClass({ isActive }) {
  return [
    'flex-1 sm:flex-none text-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-gray-600 hover:bg-gray-100',
  ].join(' ')
}

export default function AppShell() {
  const { user } = useAuth()
  const { lang, setLang, t } = useLang()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Top row on mobile: logo + lang/signout */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl shrink-0">🔋</span>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gray-900 leading-none">{t('appTitle')}</h1>
                <p className="text-xs text-gray-500 truncate">{t('appSubtitle')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 sm:hidden">
              <LangSwitcher lang={lang} setLang={setLang} />
              <SignOut t={t} />
            </div>
          </div>

          {/* Nav: full-width row on mobile, inline on sm+ */}
          <nav className="flex items-center gap-1 sm:gap-1 w-full sm:w-auto overflow-x-auto">
            <NavLink to="/data" className={navLinkClass}>{t('navData')}</NavLink>
            <NavLink to="/simulation" className={navLinkClass}>{t('navSimulation')}</NavLink>
            <NavLink to="/settings" className={navLinkClass}>{t('navSettings')}</NavLink>
          </nav>

          {/* Right cluster on sm+: lang + email + signout */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <LangSwitcher lang={lang} setLang={setLang} />
            <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
              <span className="text-xs text-gray-500 max-w-32 truncate hidden md:block">{user?.email}</span>
              <SignOut t={t} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

function LangSwitcher({ lang, setLang }) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5">
      {['en', 'nl'].map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            lang === l ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function SignOut({ t }) {
  return (
    <button
      onClick={() => signOut(auth)}
      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
    >
      {t('signOut')}
    </button>
  )
}
