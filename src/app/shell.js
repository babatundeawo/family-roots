// Page-level behaviour: theme toggle, offline banner, install prompt, service worker and update card.
import { $, store, toast } from "./util.js";

export function setupShell() {
  initTheme();
  initNetwork();
  initInstall();
  initServiceWorker();
}

function initTheme() {
  const btn = $("#theme");
  const root = document.documentElement;
  const dark = () => (root.getAttribute("data-theme") ? root.getAttribute("data-theme") === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  const sync = () => {
    btn.setAttribute("aria-label", dark() ? "Switch to light theme" : "Switch to dark theme");
    document.querySelectorAll('meta[name="theme-color"][data-scheme]').forEach((m) => m.setAttribute("media", (m.dataset.scheme === "dark") === dark() ? "all" : "not all"));
  };
  btn.addEventListener("click", () => {
    const next = dark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store("fr-theme", next);
    sync();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", sync);
  sync();
}

function initNetwork() {
  const bar = document.createElement("div");
  bar.className = "net-banner"; bar.setAttribute("role", "status"); bar.hidden = true;
  bar.textContent = "You are offline. Changes will be saved when you reconnect.";
  $("#overlays").append(bar);
  const update = () => { bar.hidden = navigator.onLine; };
  addEventListener("online", () => { update(); toast("Back online"); });
  addEventListener("offline", update);
  update();
}

function card(html) {
  const el = document.createElement("section");
  el.className = "app-card"; el.innerHTML = html;
  $("#overlays").append(el);
  return el;
}

function initInstall() {
  const btn = $("#install");
  let deferred = null;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; btn.hidden = false; });
  addEventListener("appinstalled", () => { btn.hidden = true; deferred = null; toast("Installed. Find Family Roots on your home screen."); });
  btn.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null; btn.hidden = true;
  });
  // iPhone and iPad have no install prompt, so show one short how-to the first time.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (ios && !standalone && !store("fr-ios-tip")) {
    const c = card(`<h2>Add Family Roots to your home screen</h2><ol><li>Tap the <strong>Share</strong> button in Safari.</li><li>Choose <strong>Add to Home Screen</strong>.</li></ol><div class="row"><button class="btn sm" type="button">Got it</button></div>`);
    c.querySelector("button").addEventListener("click", () => { store("fr-ios-tip", "1"); c.remove(); });
  }
}

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (refreshing) return; refreshing = true; location.reload(); });
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const offer = (worker) => {
      const c = card(`<h2>A new version is ready</h2><p>Refresh to get the latest improvements. Nothing you have saved is lost.</p><div class="row"><button class="btn sm" type="button" data-go>Refresh</button><button class="btn ghost sm" type="button" data-later>Later</button></div>`);
      c.querySelector("[data-go]").addEventListener("click", () => worker.postMessage({ type: "SKIP_WAITING" }));
      c.querySelector("[data-later]").addEventListener("click", () => c.remove());
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch(() => {});
}
