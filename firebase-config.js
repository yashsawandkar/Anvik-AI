// firebase-config.js
// -----------------------------------------------------------------------------
// Anvik AI — Firebase initialization.
//
// This is the ONLY file that should contain your Firebase project configuration.
// It uses the official Firebase Web SDK (modular v10, loaded straight from
// Google's CDN as ES modules — no build step / bundler required).
//
// If you ever need to point this app at a different Firebase project, this is
// the only place you should have to edit.
// -----------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBRXckTxHn1sIIpbHgNM1p3kNSkKbiyVD8",
  authDomain: "anvik-ea115.firebaseapp.com",
  projectId: "anvik-ea115",
  storageBucket: "anvik-ea115.firebasestorage.app",
  messagingSenderId: "387832081051",
  appId: "1:387832081051:web:20256b3b27aaa55ce8343e",
};

// Initialize Firebase (once — this module is only ever loaded once by the browser's
// module cache, even though it's imported from multiple places).
export const firebaseApp = initializeApp(firebaseConfig);

// Firebase Authentication instance, shared by the whole app.
export const auth = getAuth(firebaseApp);

// Google OAuth provider used by "Continue with Google".
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ---------------------------------------------------------------------------
// Future scaling: when you add Firestore/Storage/Analytics later, initialize
// and export them from here too (e.g. `export const db = getFirestore(firebaseApp);`)
// so every other file keeps importing from this single, central place.
// ---------------------------------------------------------------------------
