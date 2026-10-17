// Applies the saved/system theme before first paint (no flash) and wires the toggle.
(function () {
  var d = document.documentElement, k = 'fr-theme';
  var saved; try { saved = localStorage.getItem(k); } catch (e) {}
  var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  d.dataset.theme = dark ? 'dark' : 'light';
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('theme').addEventListener('click', function () {
      var next = d.dataset.theme === 'dark' ? 'light' : 'dark';
      d.dataset.theme = next; try { localStorage.setItem(k, next); } catch (e) {}
    });
  });
})();
