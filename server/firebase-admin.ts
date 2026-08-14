import { cert, getApps, initializeApp } from 'firebase-admin/app'

export interface AdminEnv {
  FIREBASE_PRIVATE_KEY_ID?: string
  FIREBASE_PRIVATE_KEY?: string
  FIREBASE_CLIENT_EMAIL?: string
  FIREBASE_CLIENT_ID?: string
  VITE_FIREBASE_PROJECT_ID?: string
}

export interface AdminCheckResult {
  ok: boolean
  projectId?: string
  clientEmail?: string
  error?: string
  missing?: string[]
}

export function checkAdminEnv(env: AdminEnv): AdminCheckResult {
  const required = [
    'FIREBASE_PRIVATE_KEY_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_CLIENT_ID',
  ] as const

  const missing = required.filter((key) => !env[key]?.trim())
  if (missing.length > 0) {
    return { ok: false, missing: [...missing], error: `Липсват: ${missing.join(', ')}` }
  }

  const projectId =
    env.VITE_FIREBASE_PROJECT_ID?.trim() ||
    env.FIREBASE_CLIENT_EMAIL!.match(/@([^.]+)\.iam\.gserviceaccount\.com$/)?.[1]

  if (!projectId) {
    return { ok: false, error: 'Не може да се определи project ID от FIREBASE_CLIENT_EMAIL' }
  }

  try {
    if (!getApps().length) {
      const privateKey = env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n')
      initializeApp({
        credential: cert({
          projectId,
          privateKey,
          clientEmail: env.FIREBASE_CLIENT_EMAIL!,
        }),
      })
    }

    return {
      ok: true,
      projectId,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
    }
  } catch (error) {
    return {
      ok: false,
      projectId,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function pingFirestore(env: AdminEnv): Promise<AdminCheckResult> {
  return checkAdminEnv(env)
}
