import { useState } from 'react'
import {
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLang } from '../../context/LangContext.jsx'
import { clearAllEnergyData } from '../../services/firestoreData.js'
import { deletePreferences } from '../../services/preferences.js'
import { invalidateEnergyCache } from '../../hooks/useEnergyData.js'

export default function DangerZone({ stats, onCleared }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [confirming, setConfirming] = useState(null) // null | 'data' | 'account'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')

  async function doClearAll() {
    if (!user) return
    setBusy(true)
    setError('')
    try {
      await clearAllEnergyData(user.uid)
      invalidateEnergyCache(user.uid)
      onCleared?.()
      setConfirming(null)
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function reauth() {
    const providerIds = user.providerData.map(p => p.providerId)
    if (providerIds.includes('google.com')) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider())
    } else if (providerIds.includes('password')) {
      if (!password) throw new Error(t('passwordRequired'))
      const cred = EmailAuthProvider.credential(user.email, password)
      await reauthenticateWithCredential(user, cred)
    } else {
      throw new Error('No supported reauth method')
    }
  }

  async function doDeleteAccount() {
    if (!user) return
    setBusy(true)
    setError('')
    try {
      await reauth()
      // Best-effort cleanup of subcollections before deleting the auth user
      try { await clearAllEnergyData(user.uid) } catch { /* ignore */ }
      try { await deletePreferences(user.uid) } catch { /* ignore */ }
      await deleteUser(user)
    } catch (e) {
      setError(e.message ?? String(e))
      setBusy(false)
      return
    }
    setBusy(false)
    setConfirming(null)
  }

  const usesPassword = user?.providerData?.some(p => p.providerId === 'password')

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">{t('storageUsage')}</h3>
        <p className="text-sm text-gray-600">
          {stats ? `${stats.hours.toLocaleString()} ${t('hoursStored')} · ${stats.months} ${t('monthsStored')}` : '—'}
        </p>
      </div>

      <div className="border border-red-200 rounded-xl bg-red-50/50 p-4 space-y-3">
        <h3 className="font-semibold text-red-800">{t('settingsDanger')}</h3>

        {/* Delete all data */}
        <div>
          {confirming === 'data' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-red-800">{t('clearAllConfirm')}</span>
              <button
                onClick={doClearAll}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-50"
              >
                {t('confirmDelete')}
              </button>
              <button
                onClick={() => setConfirming(null)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs"
              >
                {t('cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming('data')}
              disabled={busy || !stats || stats.months === 0}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium disabled:opacity-40"
            >
              🗑️ {t('deleteAllData')}
            </button>
          )}
        </div>

        {/* Delete account */}
        <div>
          {confirming === 'account' ? (
            <div className="space-y-2">
              <p className="text-sm text-red-800">{t('deleteAccountConfirm')}</p>
              {usesPassword && (
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('password')}
                  className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={doDeleteAccount}
                  disabled={busy || (usesPassword && !password)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-50"
                >
                  {t('confirmDelete')}
                </button>
                <button
                  onClick={() => { setConfirming(null); setPassword('') }}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming('account')}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-40"
            >
              ⚠️ {t('deleteAccount')}
            </button>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
