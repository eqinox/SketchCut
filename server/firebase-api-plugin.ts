import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import { pingFirestore } from './firebase-admin.ts'

export function firebaseApiPlugin(): Plugin {
  return {
    name: 'sketchcut-firebase-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/firebase/status') {
          next()
          return
        }

        const env = loadEnv(server.config.mode, server.config.root, '')
        const clientMissing = [
          'VITE_FIREBASE_API_KEY',
          'VITE_FIREBASE_AUTH_DOMAIN',
          'VITE_FIREBASE_PROJECT_ID',
          'VITE_FIREBASE_STORAGE_BUCKET',
          'VITE_FIREBASE_MESSAGING_SENDER_ID',
          'VITE_FIREBASE_APP_ID',
        ].filter((key) => !env[key]?.trim())

        const adminResult = await pingFirestore(env)

        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            client: {
              ok: clientMissing.length === 0,
              missing: clientMissing,
              projectId: env.VITE_FIREBASE_PROJECT_ID ?? null,
              adminEmail: env.VITE_ADMIN_EMAIL ?? env.ADMIN_EMAIL ?? null,
            },
            admin: adminResult,
          }),
        )
      })
    },
  }
}
