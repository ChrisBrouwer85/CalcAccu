import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase.js'

export const DEFAULT_PREFERENCES = {
  lang: 'en',
  defaults: {
    accuConfig: {
      selectedSizes: [5, 10],
      customSize: '',
      efficiency: 0.95,
      maxRateKw: 5,
      costPerKwh: 500,
    },
    strategy: {
      mode: 'fixed',
      homePriority: 0.8,
      sellFraction: 0.5,
      allowGridCharge: false,
    },
    priceConfig: {
      country: 'NL',
      sellPrice: 0.10,
    },
  },
  sensorTariffs: {},
}

function preferencesRef(uid) {
  return doc(db, 'users', uid, 'settings', 'preferences')
}

function mergeDefaults(stored) {
  if (!stored) return DEFAULT_PREFERENCES
  const storedStrategy = stored.defaults?.strategy
  const legacyHomePriority = stored.defaults?.homePriority
  return {
    lang: stored.lang ?? DEFAULT_PREFERENCES.lang,
    defaults: {
      accuConfig: { ...DEFAULT_PREFERENCES.defaults.accuConfig, ...(stored.defaults?.accuConfig ?? {}) },
      strategy: {
        ...DEFAULT_PREFERENCES.defaults.strategy,
        ...(storedStrategy ?? {}),
        // Backward-compat: migrate old homePriority scalar into strategy
        homePriority: storedStrategy?.homePriority ?? legacyHomePriority ?? DEFAULT_PREFERENCES.defaults.strategy.homePriority,
      },
      priceConfig: { ...DEFAULT_PREFERENCES.defaults.priceConfig, ...(stored.defaults?.priceConfig ?? {}) },
    },
    sensorTariffs: stored.sensorTariffs ?? {},
    legacyCleanedAt: stored.legacyCleanedAt ?? null,
  }
}

export async function getPreferences(uid) {
  const snap = await getDoc(preferencesRef(uid))
  return mergeDefaults(snap.exists() ? snap.data() : null)
}

export async function savePreferences(uid, patch) {
  await setDoc(preferencesRef(uid), { ...patch, updatedAt: Timestamp.now() }, { merge: true })
}

export async function deletePreferences(uid) {
  await deleteDoc(preferencesRef(uid))
}
