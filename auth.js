// auth.js
// -----------------------------------------------------------------------------
// Anvik AI — Firebase Authentication logic.
//
// All real authentication (Email/Password + Google, via Firebase Auth) lives
// here. index.html only imports these functions and wires them to the UI —
// it never talks to Firebase directly. This keeps the auth backend swappable
// and easy to unit-test in isolation later.
// -----------------------------------------------------------------------------

import { auth, googleProvider } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

/**
 * Maps raw Firebase Auth error codes to short, user-friendly messages.
 * Falls back to the raw Firebase message for anything not explicitly mapped.
 */
export function friendlyAuthError(error) {
  const code = error && error.code;
  const messages = {
    "auth/email-already-in-use": "That email is already registered. Try logging in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/missing-password": "Please enter a password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-login-credentials": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/user-disabled": "This account has been disabled. Contact support for help.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/cancelled-popup-request": "Sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked the sign-in popup. Please allow popups and try again.",
    "auth/network-request-failed": "Network error — please check your connection and try again.",
    "auth/operation-not-allowed": "This sign-in method is not enabled for this project yet.",
    "auth/account-exists-with-different-credential":
      "An account already exists with this email using a different sign-in method.",
  };
  return messages[code] || (error && error.message) || "Something went wrong. Please try again.";
}

/** Create a new account with email + password, then set the user's display name. */
export async function signUpWithEmail(name, email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    try {
      await updateProfile(credential.user, { displayName: name });
    } catch (e) {
      // Non-fatal — the account was still created successfully.
      console.warn("Anvik AI: could not set display name after signup:", e);
    }
  }
  return credential.user;
}

/** Sign in an existing user with email + password. */
export async function signInWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/** Sign in (or sign up, on first use) with a Google account via a popup. */
export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/** Send a password-reset email to the given address. */
export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

/** Sign the current user out. */
export function logOutUser() {
  return signOut(auth);
}

/**
 * Subscribe to auth state changes. `callback` receives the Firebase User object
 * (or null when signed out) and is called once immediately with the restored
 * session (if any), then again on every future sign-in / sign-out.
 * Returns the unsubscribe function.
 */
export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
