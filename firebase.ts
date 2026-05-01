import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const getSafeEnv = (key: string, fallback: string) => {
  const value = import.meta.env[key];
  if (typeof value === 'string' && value.length > 5 && value !== "undefined") return value;
  return fallback;
};

const firebaseConfig = {
  apiKey: getSafeEnv("VITE_FIREBASE_API_KEY", "AIzaSyA3EalskfSuRTknHqglAnItuUZ4dk8b1qM"),
  authDomain: getSafeEnv("VITE_FIREBASE_AUTH_DOMAIN", "gen-lang-client-0830467969.firebaseapp.com"),
  projectId: getSafeEnv("VITE_FIREBASE_PROJECT_ID", "gen-lang-client-0830467969"),
  storageBucket: getSafeEnv("VITE_FIREBASE_STORAGE_BUCKET", "gen-lang-client-0830467969.firebasestorage.app"),
  messagingSenderId: getSafeEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "144922184803"),
  appId: getSafeEnv("VITE_FIREBASE_APP_ID", "1:144922184803:web:8e2a3a39e4d07241403c56"),
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const databaseId = getSafeEnv("VITE_FIREBASE_DATABASE_ID", "ai-studio-bc6f0e28-2c16-4fcc-8edc-d835afc95616");
export const db = getFirestore(app, databaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
