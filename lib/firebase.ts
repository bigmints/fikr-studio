import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBSv_Z_PaXOk0HpTrM_PxoqFkK0SPQXIFw",
  authDomain: "fikr-apps.firebaseapp.com",
  projectId: "fikr-apps",
  storageBucket: "fikr-apps.firebasestorage.app",
  messagingSenderId: "69536493117",
  appId: "1:69536493117:web:545d15b5c440fbb9918454",
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}
