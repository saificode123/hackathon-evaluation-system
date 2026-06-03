import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const rawConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
let _app: FirebaseApp | null = null;
let _secondaryApp: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _secondaryAuth: Auth | null = null;

const hasCredentials = !!(
  rawConfig.apiKey &&
  rawConfig.projectId &&
  rawConfig.apiKey !== "undefined" &&
  rawConfig.apiKey.length > 10
);

console.log("Firebase rawConfig in browser:", rawConfig, "hasCredentials:", hasCredentials);

if (hasCredentials) {
  try {
    _app = getApps().find((a) => a.name === "[DEFAULT]") ?? initializeApp(rawConfig);
    _secondaryApp = getApps().find((a) => a.name === "secondary") ?? initializeApp(rawConfig, "secondary");
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    _secondaryAuth = getAuth(_secondaryApp);
  } catch (e) {
    console.error("Firebase initialization failed completely:", e);
  }
}

export const isFirebaseConfigured = () =>
  !!(
    hasCredentials &&
    _app &&
    _db &&
    _auth
  );

export const app = _app;
export const auth = _auth as Auth;
export const db = _db as Firestore;
export const secondaryAuth = _secondaryAuth as Auth;

export default _app;
