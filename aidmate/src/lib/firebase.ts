import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getDatabase, connectDatabaseEmulator, type Database } from 'firebase/database';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCGTDTwxJfb-sRTxRzIIaEow5PIVueDfDY",
  authDomain: "gdg-aido.firebaseapp.com",
  projectId: "gdg-aido",
  storageBucket: "gdg-aido.firebasestorage.app",
  messagingSenderId: "787667952553",
  appId: "1:787667952553:web:1e20fb39331d69f52f5ab8",
  measurementId: "G-C0SL3DVGKL"
};

// Initialize Firebase App (singleton pattern)
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app);
export const storage: FirebaseStorage = getStorage(app);

// Connect to emulators in development if configured
const isDev = import.meta.env.DEV;
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

if (isDev && useEmulator) {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.info('[Firebase] Connected to local emulators successfully');
  } catch (error) {
    console.warn('[Firebase] Emulators already initialized or connection error:', error);
  }
}

export default app;
