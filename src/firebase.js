import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const {
  VITE_FIREBASE_API_KEY: apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: authDomain,
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_STORAGE_BUCKET: storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
  VITE_FIREBASE_APP_ID: appId,
} = import.meta.env

export const firebaseConfigured = Boolean(apiKey && authDomain && projectId && appId)

export const auth = firebaseConfigured
  ? getAuth(initializeApp({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }))
  : null
