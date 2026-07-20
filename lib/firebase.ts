import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBSv_Z_PaXOk0HpTrM_PxoqFkK0SPQXIFw", // gitleaks:allow public Firebase web API key
  authDomain: "fikr-apps.firebaseapp.com",
  projectId: "fikr-apps",
  storageBucket: "fikr-apps.firebasestorage.app",
  messagingSenderId: "69536493117",
  appId: "1:69536493117:web:545d15b5c440fbb9918454",
};

let app: FirebaseApp;
let auth: Auth;

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
