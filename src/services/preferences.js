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
      sellFraction: 0.5,
      allowGridChargeCheap: false,
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
  return {
    lang: stored.lang ?? DEFAULT_PREFERENCES.lang,
    defaults: {
      accuConfig: { ...DEFAULT_PREFERENCES.defaults.accuConfig, ...(stored.defaults?.accuConfig ?? {}) },
      strategy: (() => {
        const { allowGridCharge, allowGridChargeNegative, ...s } = stored.defaults?.strategy ?? {}
        // allowGridCharge and allowGridChargeNegative are obsolete — negative-price charging
        // is now always active; allowGridChargeCheap is the only remaining flag.
        // Migrate: if either old flag was on, enable allowGridChargeCheap too.
        const cheapFromMigration = (allowGridCharge || allowGridChargeNegative) ? { allowGridChargeCheap: true } : {}
        return { ...DEFAULT_PREFERENCES.defaults.strategy, ...s, ...cheapFromMigration }
      })(),
      priceConfig: { ...DEFAULT_PREFERENCES.defaults.priceConfig, ...(stored.defaults?.priceConfig ?? {}) },
    },
    sensorTariffs: stored.sensorTariffs ?? {},
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
