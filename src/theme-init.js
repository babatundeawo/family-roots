/* Runs before first paint so the saved colour scheme and sign-in hint apply immediately (no flash). */
(function () {
  "use strict";
  var root = document.documentElement;
  try {
    var t = localStorage.getItem("fr-theme");
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
    if (localStorage.getItem("fr-session") === "1") root.classList.add("has-session");
  } catch (e) { /* storage blocked: follow the system theme */ }
  var m = document.querySelector('meta[name="theme-color"][data-scheme]');
  if (m) {
    var dark = root.getAttribute("data-theme") ? root.getAttribute("data-theme") === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (x) { x.setAttribute("media", (x.getAttribute("data-scheme") === "dark") === dark ? "all" : "not all"); });
  }
})();
