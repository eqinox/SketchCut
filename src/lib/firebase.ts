import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  type Firestore,
} from 'firebase/firestore'
import type { SavedProject } from '@/types'
import { getClientEnv, getMissingClientEnvKeys } from '@/lib/env'
import { formatFirebaseError } from '@/lib/firebase-errors'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let initError: string | null = null

function initFirebase(): void {
  if (app || initError) return

  const missing = getMissingClientEnvKeys()
  if (missing.length > 0) {
    initError = `Липсват environment variables: ${missing.join(', ')}`
    return
  }

  const env = getClientEnv()
  try {
    app = initializeApp({
      apiKey: env.apiKey,
      authDomain: env.authDomain,
      projectId: env.projectId,
      storageBucket: env.storageBucket,
      messagingSenderId: env.messagingSenderId,
      appId: env.appId,
    })
    auth = getAuth(app)
    db = getFirestore(app)
    setPersistence(auth, browserLocalPersistence).catch((e) => {
      console.error('Firebase persistence error:', e)
    })
  } catch (error) {
    initError = formatFirebaseError(error)
  }
}

initFirebase()

export function getFirebaseInitError(): string | null {
  return initError
}

function requireAuth(): Auth {
  initFirebase()
  if (initError || !auth) throw new Error(initError ?? 'Firebase Auth не е инициализиран')
  return auth
}

function requireDb(): Firestore {
  initFirebase()
  if (initError || !db) throw new Error(initError ?? 'Firestore не е инициализирана')
  return db
}

async function ensureAuthReady(userId: string): Promise<void> {
  const authInstance = requireAuth()
  const user = authInstance.currentUser
  if (!user || user.uid !== userId) {
    throw new Error('Не сте влезли в акаунта — Firestore изисква активен вход.')
  }
  await user.getIdToken()
}

export { auth, db }

export async function register(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(requireAuth(), email, password)
  return cred.user
}

export async function login(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(requireAuth(), email, password)
  return cred.user
}

export async function logout(): Promise<void> {
  await signOut(requireAuth())
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  if (initError || !auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback, (error) => {
    console.error('Auth state error:', error)
    callback(null)
  })
}

export async function saveProject(userId: string, project: SavedProject): Promise<void> {
  await ensureAuthReady(userId)
  const ref = doc(requireDb(), 'users', userId, 'projects', project.id)
  await setDoc(ref, {
    ...project,
    updatedAt: Date.now(),
  })
}

export async function loadProjects(userId: string): Promise<SavedProject[]> {
  await ensureAuthReady(userId)
  const q = query(collection(requireDb(), 'users', userId, 'projects'), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as SavedProject)
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  await ensureAuthReady(userId)
  await deleteDoc(doc(requireDb(), 'users', userId, 'projects', projectId))
}
