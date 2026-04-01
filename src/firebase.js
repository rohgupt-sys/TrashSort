import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const {
  VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID,
} = import.meta.env;

// Only initialise if all required vars are present and not placeholder values
const isConfigured =
  VITE_FIREBASE_API_KEY &&
  VITE_FIREBASE_PROJECT_ID &&
  !VITE_FIREBASE_API_KEY.startsWith("your_");

let db = null;

if (isConfigured) {
  const app = initializeApp({
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: VITE_FIREBASE_APP_ID,
  });
  db = getFirestore(app);
}

export { db, isConfigured };
