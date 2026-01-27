// js/app.js
(function () {
  const root = document.documentElement;

  // ===== CURSOR (kursor) =====
  function getCursorColor() {
    const v = getComputedStyle(root).getPropertyValue("--cursor").trim();
    return v || "#ffffff";
  }

  function cleanupOldKursorDom() {
    document.querySelectorAll('[class*="kursor"]').forEach((el) => el.remove());
  }

  function initCursor(force) {
    if (!window.kursor) return;

    if (window.__AMADAS_CURSOR__ && !force) return;

    if (force) {
      cleanupOldKursorDom();
      window.__AMADAS_CURSOR__ = false;
    }

    window.__AMADAS_CURSOR__ = true;

    new window.kursor({
      type: 1,
      removeDefaultCursor: true,
      color: getCursorColor(),
    });
  }

  function refreshCursor() {
    if (!window.kursor) return;
    initCursor(true);
  }

  function start() {
    // init theme (nếu theme-toggle.js đã được load)
    if (typeof window.initThemeToggle === "function") {
      window.initThemeToggle(() => refreshCursor());
    }

    // init cursor
    initCursor(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
