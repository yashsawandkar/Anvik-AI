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
  signInWithRedirect,
  getRedirectResult,
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

/**
 * True on browsers where Google's OAuth popup is unreliable — most phones/tablets,
 * and any in-app/embedded browser (which Google blocks OAuth in outright). On these
 * we use a full-page redirect instead of a popup.
 */
function shouldUseRedirectForGoogle() {
  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isNarrow = typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth < 768;
  return isMobileUA || isNarrow;
}

/**
 * Sign in (or sign up, on first use) with a Google account.
 *
 * Uses a popup on desktop, and falls back to a full-page redirect on mobile or
 * whenever the popup is blocked/unsupported — many mobile browsers refuse to open
 * Google's OAuth popup at all, which previously surfaced as a silent failure (the
 * user would land back on the login form with a confusing "Incorrect email or
 * password" message that had nothing to do with what they'd actually done).
 *
 * When a redirect is used, this resolves to null immediately because the browser
 * is about to navigate away to accounts.google.com. Call
 * completeGoogleRedirectSignIn() on page load to pick up the result once Google
 * redirects back.
 */
export async function signInWithGoogle() {
  if (shouldUseRedirectForGoogle()) {
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return credential.user;
  } catch (error) {
    const code = error && error.code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

/**
 * Call once on page load to pick up the result of a Google sign-in that finished
 * via signInWithRedirect() (i.e. the browser just navigated back to this page).
 * Resolves to the signed-in user, or null if there was no pending redirect result.
 */
export async function completeGoogleRedirectSignIn() {
  const credential = await getRedirectResult(auth);
  return credential ? credential.user : null;
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
