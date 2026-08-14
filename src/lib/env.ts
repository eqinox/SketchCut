const VITE_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

export type ViteEnvKey = (typeof VITE_KEYS)[number]

export function getClientEnv(): {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  adminEmail: string
} {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
    adminEmail: import.meta.env.VITE_ADMIN_EMAIL ?? '',
  }
}

export function getMissingClientEnvKeys(): ViteEnvKey[] {
  return VITE_KEYS.filter((key) => !import.meta.env[key]?.trim())
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = import.meta.env.VITE_ADMIN_EMAIL?.trim()
  return !!admin && !!email && email.toLowerCase() === admin.toLowerCase()
}

/** projectId from FIREBASE_CLIENT_EMAIL: xxx@PROJECT_ID.iam.gserviceaccount.com */
export function projectIdFromClientEmail(clientEmail: string): string | null {
  const match = clientEmail.match(/@([^.]+)\.iam\.gserviceaccount\.com$/)
  return match?.[1] ?? null
}
