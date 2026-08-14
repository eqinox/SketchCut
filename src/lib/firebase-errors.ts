import { FirebaseError } from 'firebase/app'

const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/invalid-api-key': 'Невалиден VITE_FIREBASE_API_KEY — провери Firebase Console → Web app.',
  'auth/network-request-failed': 'Няма мрежова връзка към Firebase Auth.',
  'auth/email-already-in-use': 'Този имейл вече е регистриран.',
  'auth/invalid-email': 'Невалиден имейл адрес.',
  'auth/user-not-found': 'Няма акаунт с този имейл.',
  'auth/wrong-password': 'Грешна парола.',
  'auth/too-many-requests': 'Твърде много опити — опитай по-късно.',
  'auth/weak-password': 'Паролата е твърде слаба (мин. 6 символа).',
  'permission-denied':
    'Firestore: нямате права (permission-denied). Влезте в акаунта и проверете дали firestore.rules са качени в Firebase Console → Firestore → Rules (команда: npx firebase deploy --only firestore:rules).',
  'unavailable': 'Firestore е недостъпна (unavailable).',
  'unauthenticated': 'Не сте влезли в акаунта.',
  'not-found': 'Документът не е намерен в базата.',
  'failed-precondition': 'Firestore индекс липсва или условието не е изпълнено.',
  'invalid-argument': 'Невалидни данни за Firestore.',
}

export function formatFirebaseError(error: unknown): string {
  if (error instanceof FirebaseError) {
    const friendly = FIREBASE_MESSAGES[error.code]
    if (friendly) return `[${error.code}] ${friendly}`
    return `[${error.code}] ${error.message}`
  }
  if (error instanceof Error) return error.message
  return String(error)
}

export function formatUnknownError(error: unknown): string {
  return formatFirebaseError(error)
}
