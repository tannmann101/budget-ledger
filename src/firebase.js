import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from "firebase/firestore";

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";

// Safe to commit: these are public client identifiers, not secrets.
// Access is controlled by Firestore security rules + Google sign-in, not by hiding this config.
// Replace with your own project's values from Firebase Console -> Project settings -> Your apps.
const firebaseConfig = useEmulator
  ? { apiKey: "demo-key", authDomain: "localhost", projectId: "demo-budget-ledger" }
  : {
      apiKey: "AIzaSyCPMF6fA47f-QWPaWIjpCM7s_DZ4VoAtns",
      authDomain: "household-ledger-c37a7.firebaseapp.com",
      projectId: "household-ledger-c37a7",
      storageBucket: "household-ledger-c37a7.firebasestorage.app",
      messagingSenderId: "727936284421",
      appId: "1:727936284421:web:ba11a6272598d1ffaf696c",
    };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// .env.local sets VITE_USE_FIREBASE_EMULATOR=true so local development never touches the real project.
if (useEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
