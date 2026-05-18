import { useState } from 'react'
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '../firebase.js'

function mapError(code, t) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential': return t('loginErrorEmail')
    case 'auth/wrong-password':     return t('loginErrorPassword')
    case 'auth/email-already-in-use': return t('loginErrorEmailTaken')
    case 'auth/weak-password':      return t('loginErrorWeakPassword')
    default:                        return t('loginErrorGeneric')
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 12.094 17.64 9.787 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginScreen({ t, lang, setLang }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGoogle() {
    setLoading(true)
    setError(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(t('loginErrorGeneric'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
    } catch (e) {
      setError(mapError(e.code, t))
    } finally {
      setLoading(false)
    }
  }

  function toggleMode() {
    setMode(m => m === 'signin' ? 'register' : 'signin')
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="fixed top-4 right-4">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {['en', 'nl'].map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                lang === l ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="text-5xl mb-3 block">🔋</span>
          <h1 className="text-2xl font-bold text-gray-900">{t('appTitle')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('loginSubtitle')}</p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <GoogleIcon />
          {t('loginWithGoogle')}
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">{t('loginOr')}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('loginEmail')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('loginEmailPlaceholder')}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('loginPassword')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('loginPasswordPlaceholder')}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t('loginLoading') : mode === 'signin' ? t('loginSignIn') : t('loginRegister')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          {mode === 'signin' ? t('loginNoAccount') : t('loginHaveAccount')}{' '}
          <button onClick={toggleMode} className="text-blue-600 hover:underline font-medium">
            {mode === 'signin' ? t('loginRegister') : t('loginSignIn')}
          </button>
        </p>
      </div>
    </div>
  )
}
