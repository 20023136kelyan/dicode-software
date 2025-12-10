import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAnalytics, type Analytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

type FirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredKeys: (keyof FirebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
if (missingKeys.length > 0) {
  console.warn(
    '[firebase] Missing config values:',
    missingKeys.join(', '),
    '→ make sure `.env` exists. See docs/firebase.md.'
  );
}

function createFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    const existing = getApps()[0];
    console.info('[firebase] Reusing existing app:', existing.name);
    return existing;
  }

  const app = initializeApp(firebaseConfig);
  console.info('[firebase] Initialized app:', {
    name: app.name,
    projectId: app.options.projectId,
  });
  return app;
}

const app = createFirebaseApp();
const analytics: Analytics | undefined =
  typeof window !== 'undefined' && firebaseConfig.measurementId
    ? getAnalytics(app)
    : undefined;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');

// Connect to Functions emulator if in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
  console.info('[firebase] Connected to Functions emulator');
}

export { app, analytics, auth, db, storage, functions, firebaseConfig };

