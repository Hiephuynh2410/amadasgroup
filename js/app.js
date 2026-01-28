// js/app.js
(function () {
  const root = document.documentElement;

  // =========================
  // Helpers: wait until header (included) exists
  // =========================
  function waitForHeaderReady(cb) {
    // if header already in DOM -> run now
    const hasHeaderNow =
      document.getElementById("brandLogo") ||
      document.getElementById("themeToggle") ||
      document.querySelector("#header-container .site-header");

    if (hasHeaderNow) {
      cb();
      return;
    }

    // watch DOM changes until header is injected by include.js
    const container = document.getElementById("header-container") || document.body;

    const obs = new MutationObserver(() => {
      const ok =
        document.getElementById("brandLogo") ||
        document.getElementById("themeToggle") ||
        document.querySelector("#header-container .site-header");
      if (ok) {
        obs.disconnect();
        cb();
      }
    });

    obs.observe(container, { childList: true, subtree: true });

    // safety fallback: stop watching after ~5s
    setTimeout(() => {
      try { obs.disconnect(); } catch (e) {}
      cb(); // chạy thử lần cuối, nếu chưa có thì cũng không crash
    }, 5000);
  }

  // =========================
  // THEME + LOGO
  // =========================
  function getPreferredTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;

    const prefersLight =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;

    return prefersLight ? "light" : "dark";
  }

  function setLogoByTheme(theme) {
    const logo =
      document.getElementById("brandLogo") ||
      document.querySelector("img.brand-logo") ||
      document.querySelector(".brand img");

    if (!logo) return;

    const darkSrc = logo.getAttribute("data-logo-dark") || "/img/logo_white.png";
    const lightSrc = logo.getAttribute("data-logo-light") || "/img/logo.png";

    const nextSrc = theme === "light" ? lightSrc : darkSrc;
    if (nextSrc && logo.getAttribute("src") !== nextSrc) {
      logo.setAttribute("src", nextSrc);
    }
  }

  function setTheme(theme, opts) {
    opts = opts || {};
    const save = opts.save !== undefined ? opts.save : true;
    const onChange = typeof opts.onChange === "function" ? opts.onChange : null;

    root.setAttribute("data-theme", theme);
    if (save) localStorage.setItem("theme", theme);

    const btn = document.getElementById("themeToggle");
    if (btn) btn.setAttribute("aria-pressed", String(theme === "light"));

    const themeIcon = document.getElementById("themeIcon");
    if (themeIcon) {
      themeIcon.innerHTML =
        theme === "light"
          ? '<path d="M12 18a6 6 0 1 0 0-12a6 6 0 0 0 0 12Z"></path><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M4.93 19.07l1.41-1.41"></path><path d="M17.66 6.34l1.41-1.41"></path>'
          : '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"></path>';
    }

    setLogoByTheme(theme);

    if (onChange) onChange(theme);
  }

  function bindThemeToggle(onThemeChange) {
    const btn = document.getElementById("themeToggle");
    if (!btn) return; // header chưa có

    // init 1 lần
    if (!window.__AMADAS_THEME_INIT__) {
      window.__AMADAS_THEME_INIT__ = true;
      setTheme(getPreferredTheme(), { save: true, onChange: onThemeChange });

      // auto change theo OS nếu user chưa set theme thủ công
      const mq =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: light)");
      if (mq && !mq.__AMADAS_THEME_MQ_BOUND__) {
        mq.__AMADAS_THEME_MQ_BOUND__ = true;
        mq.addEventListener("change", function () {
          const saved = localStorage.getItem("theme");
          if (!saved) setTheme(getPreferredTheme(), { save: false, onChange: onThemeChange });
        });
      }
    } else {
      // nếu header mới được include sau, chỉ cần sync logo theo theme hiện tại
      const cur = root.getAttribute("data-theme") || getPreferredTheme();
      setLogoByTheme(cur);
    }

    // bind click 1 lần cho mỗi nút themeToggle (tránh bind trùng)
    if (!btn.__AMADAS_THEME_BOUND__) {
      btn.__AMADAS_THEME_BOUND__ = true;
      btn.addEventListener("click", function () {
        const cur = root.getAttribute("data-theme") || "dark";
        const next = cur === "dark" ? "light" : "dark";
        setTheme(next, { save: true, onChange: onThemeChange });
      });
    }
  }

  // =========================
  // CURSOR (kursor)
  // =========================
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

  // =========================
  // START
  // =========================
  function startOnceHeaderExists() {
    // Theme + Logo + Cursor refresh when theme changes
    bindThemeToggle(() => refreshCursor());

    // Cursor init (after theme applied so color correct)
    initCursor(false);

    // Ensure logo is correct even if theme already set before header existed
    const currentTheme = root.getAttribute("data-theme") || getPreferredTheme();
    setLogoByTheme(currentTheme);
  }

  function start() {
    waitForHeaderReady(startOnceHeaderExists);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
