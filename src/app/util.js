// Small helpers shared by the app. No dependencies.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ENT[c]);
export const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export function years(p) {
  if (p.birthYear && p.deathYear) return `${p.birthYear}–${p.deathYear}`;
  if (p.birthYear) return `b. ${p.birthYear}`;
  if (p.deathYear) return `d. ${p.deathYear}`;
  return "";
}

export function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch (e) { /* storage blocked (private mode): carry on without it */ }
  return null;
}

let toastTimer;
export function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.className = "sr-only";
    document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}

// Opens a dialog with the given HTML. Closing it clears it, so no stale content is left behind.
export function openDialog(dlg, html) {
  dlg.innerHTML = html;
  if (!dlg.open) dlg.showModal();
}
export function wireDialog(dlg) {
  dlg.addEventListener("close", () => { dlg.innerHTML = ""; });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
  });
}

// A friendly replacement for window.confirm. Resolves true or false.
export function confirmDialog({ title, body, yes = "Delete", danger = true }) {
  const dlg = $("#confirm");
  return new Promise((resolve) => {
    openDialog(dlg, `<div class="dlg-body"><h3 id="cf-title">${esc(title)}</h3><p class="mut">${esc(body)}</p>
      <div class="actions"><button class="btn ghost" type="button" data-no>Cancel</button><button class="btn${danger ? " danger" : ""}" type="button" data-yes>${esc(yes)}</button></div></div>`);
    let answer = false;
    dlg.querySelector("[data-yes]").addEventListener("click", () => { answer = true; dlg.close(); });
    dlg.querySelector("[data-no]").addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => resolve(answer), { once: true });
    dlg.querySelector("[data-no]").focus();
  });
}

export function friendlyError(err) {
  const code = err && err.code ? String(err.code) : "";
  const map = {
    "auth/invalid-email": "That email address does not look right.",
    "auth/missing-password": "Enter your password.",
    "auth/invalid-credential": "The email or password is not right.",
    "auth/wrong-password": "The email or password is not right.",
    "auth/user-not-found": "The email or password is not right.",
    "auth/email-already-in-use": "An account with that email already exists. Try signing in instead.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "No connection. Check your internet and try again.",
    "auth/popup-closed-by-user": "The Google window was closed before finishing.",
    "auth/cancelled-popup-request": "",
    "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
    "auth/unauthorized-domain": "This website address is not yet allowed to sign in. The owner needs to add it in Firebase (see docs/FIREBASE_SETUP.md).",
    "auth/operation-not-allowed": "This sign-in method is not turned on yet. The owner can enable it in Firebase (see docs/FIREBASE_SETUP.md).",
    "auth/requires-recent-login": "For safety, please sign out, sign in again, then retry.",
    "permission-denied": "You do not have permission to do that.",
    "unavailable": "No connection right now. Your change will be saved when you are back online.",
  };
  if (code.startsWith("auth/") && code in map) return map[code];
  const c = code.replace("firestore/", "");
  if (c in map) return map[c];
  return (err && err.message ? String(err.message).replace(/^Firebase:\s*/, "") : "Something went wrong. Please try again.");
}
