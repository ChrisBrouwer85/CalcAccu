import { signOut } from 'firebase/auth'
import { auth } from '../../firebase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../context/LangContext.jsx'

export default function AccountSection() {
  const { user } = useAuth()
  const { lang, setLang, t } = useLang()

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{t('email')}</label>
        <div className="text-sm text-gray-900">{user?.email ?? '—'}</div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">{t('language')}</label>
        <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
          {['en', 'nl'].map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                lang === l ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={() => signOut(auth)}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
        >
          {t('signOut')}
        </button>
      </div>
    </div>
  )
}
