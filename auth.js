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
 *
 * NOTE: this used to also trigger on any narrow window (<768px), which meant a
 * resized desktop browser (or a laptop in a split view) silently took the
 * redirect path too — the flakier of the two flows, and the one that replays
 * the splash screen on return. Redirect is now reserved for genuine mobile /
 * embedded-browser user agents only; popup is used everywhere else.
 */
function shouldUseRedirectForGoogle() {
  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\//i.test(ua);
  return isMobileUA || isInAppBrowser;
}

/** sessionStorage key used to remember "a Google redirect sign-in is in flight"
 * across the full-page navigation to accounts.google.com and back. index.html
 * checks this on load so it can skip the splash animation replay and show a
 * lightweight "Finishing sign-in…" state instead. */
const REDIRECT_PENDING_KEY = "anvik_google_redirect_pending";

/** True if this page load is the browser landing back from a Google redirect
 * sign-in (set right before signInWithRedirect(), cleared after the result is
 * read). Call this as early as possible on page load. */
export function isGoogleRedirectPending() {
  try {
    return sessionStorage.getItem(REDIRECT_PENDING_KEY) === "1";
  } catch (e) {
    return false;
  }
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
    markRedirectPending();
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return credential.user;
  } catch (error) {
    const code = error && error.code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      markRedirectPending();
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    console.error("Anvik AI: Google sign-in failed:", code || error);
    throw error;
  }
}

function markRedirectPending() {
  try {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, "1");
  } catch (e) {
    // sessionStorage unavailable (rare) — worst case the splash just replays once more.
  }
}

function clearRedirectPending() {
  try {
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
  } catch (e) {
    // no-op
  }
}

/**
 * Call once on page load to pick up the result of a Google sign-in that finished
 * via signInWithRedirect() (i.e. the browser just navigated back to this page).
 * Resolves to the signed-in user, or null if there was no pending redirect result.
 */
export async function completeGoogleRedirectSignIn() {
  try {
    const credential = await getRedirectResult(auth);
    if (credential) {
      console.log("Anvik AI: Google redirect sign-in completed for", credential.user.email);
    }
    return credential ? credential.user : null;
  } catch (error) {
    console.error("Anvik AI: Google redirect sign-in failed:", (error && error.code) || error);
    throw error;
  } finally {
    // Whether it succeeded, failed, or there was nothing to complete, the
    // "in flight" window is over — clear it so a normal future page load
    // doesn't get stuck thinking a redirect is still pending.
    clearRedirectPending();
  }
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
