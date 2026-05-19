import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase.js'
import { useAuth } from './context/AuthContext.jsx'
import { useLang } from './context/LangContext.jsx'

const AVATAR_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6']

function avatarBg(name) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function UserAvatar({ user, size = 'md' }) {
  if (!user) return null
  const cls = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs'
  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName || user.email}
        title={user.displayName || user.email}
        className={`${cls} rounded-full object-cover shrink-0`}
        referrerPolicy="no-referrer"
      />
    )
  }
  const name = user.displayName || user.email?.split('@')[0] || '?'
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center text-white font-bold select-none shrink-0`}
      style={{ backgroundColor: avatarBg(name) }}
      title={user.displayName || user.email}
    >
      {initials(name)}
    </div>
  )
}

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
              <UserAvatar user={user} size="sm" />
              <SignOut t={t} />
            </div>
          </div>

          {/* Nav: full-width row on mobile, inline on sm+ */}
          <nav className="flex items-center gap-1 sm:gap-1 w-full sm:w-auto overflow-x-auto">
            <NavLink to="/data" className={navLinkClass}>{t('navData')}</NavLink>
            <NavLink to="/prices" className={navLinkClass}>{t('navPrices')}</NavLink>
            <NavLink to="/simulation" className={navLinkClass}>{t('navSimulation')}</NavLink>
            <NavLink to="/settings" className={navLinkClass}>{t('navSettings')}</NavLink>
          </nav>

          {/* Right cluster on sm+: lang + avatar + email + signout */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <LangSwitcher lang={lang} setLang={setLang} />
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <UserAvatar user={user} />
              <span className="text-xs text-gray-500 max-w-32 truncate hidden md:block">{user?.email}</span>
              <SignOut t={t} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 overflow-x-hidden">
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
