import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let firestoreInstance: ReturnType<typeof getFirestore> | undefined;

function getAdminApp() {
  return getApps()[0] || initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  if (!firestoreInstance) {
    const firestore = getFirestore(getAdminApp(), process.env.FIRESTORE_DATABASE_ID || '(default)');
    try {
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already been initialized')) throw error;
    }
    firestoreInstance = firestore;
  }
  return firestoreInstance;
}
