// js/theme-mode.js
(function () {
  "use strict";

  if (window.__AMADAS_THEME_MODE_READY__) return;
  window.__AMADAS_THEME_MODE_READY__ = true;

  const MODE_KEY = "amadas_theme_mode"; // system | auto | dark | light
  const root = document.documentElement;

  let autoTimer = null;
  let mql = null;
  let wired = false;

  function isDaytime(now = new Date()) {
    const h = now.getHours();
    return h >= 6 && h < 18;
  }

  function nextBoundaryDelayMs(now = new Date()) {
    const d = new Date(now);
    const h = d.getHours();

    let next = new Date(d);
    if (h < 6) next.setHours(6, 0, 0, 0);
    else if (h < 18) next.setHours(18, 0, 0, 0);
    else {
      next.setDate(next.getDate() + 1);
      next.setHours(6, 0, 0, 0);
    }
    return Math.max(1000, next.getTime() - d.getTime());
  }

  function getSavedMode() {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "dark" || saved === "light" || saved === "system" || saved === "auto") return saved;
    return "system";
  }

  function getSystemTheme() {
    const prefersLight =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    return prefersLight ? "light" : "dark";
  }

  function updateLogo(theme) {
    const logo =
      document.getElementById("brandLogo") ||
      document.querySelector("img.brand-logo") ||
      document.querySelector(".brand img");

    if (!logo) return;

    const darkSrc = logo.getAttribute("data-logo-dark");
    const lightSrc = logo.getAttribute("data-logo-light");
    if (!darkSrc || !lightSrc) return;

    logo.src = theme === "light" ? lightSrc : darkSrc;
  }

  function setEffectiveTheme(theme) {
    root.setAttribute("data-theme", theme);
    updateLogo(theme);
  }

  function clearEffectiveThemeAttr() {
    root.removeAttribute("data-theme");
    updateLogo(getSystemTheme());
  }

  function stopAutoSchedule() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function onSystemChange() {
    if (getSavedMode() !== "system") return;
    clearEffectiveThemeAttr();
    syncMenuChecks("system");
  }

  function stopSystemListener() {
    if (mql && mql.removeEventListener) {
      mql.removeEventListener("change", onSystemChange);
    }
    mql = null;
  }

  function startSystemListener() {
    stopSystemListener();
    if (!window.matchMedia) return;
    mql = window.matchMedia("(prefers-color-scheme: light)");
    if (mql.addEventListener) mql.addEventListener("change", onSystemChange);
  }

  function scheduleAuto() {
    stopAutoSchedule();
    setEffectiveTheme(isDaytime() ? "light" : "dark");

    autoTimer = setTimeout(() => {
      if (getSavedMode() !== "auto") return;
      scheduleAuto();
    }, nextBoundaryDelayMs());
  }

  function syncMenuChecks(mode) {
    document.querySelectorAll(".theme-menu-item").forEach((b) => {
      b.setAttribute("aria-checked", String(b.dataset.mode === mode));
    });
  }

  function applyMode(mode) {
    localStorage.setItem(MODE_KEY, mode);

    stopAutoSchedule();
    stopSystemListener();

    if (mode === "dark") {
      setEffectiveTheme("dark");
    } else if (mode === "light") {
      setEffectiveTheme("light");
    } else if (mode === "auto") {
      scheduleAuto();
    } else {
      clearEffectiveThemeAttr();
      startSystemListener();
    }

    syncMenuChecks(mode);
  }

  function closeMenu() {
    const picker = document.getElementById("themePicker");
    const btn = document.getElementById("themeMenuBtn");
    if (picker) picker.classList.remove("is-open");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    const picker = document.getElementById("themePicker");
    const btn = document.getElementById("themeMenuBtn");
    if (picker) picker.classList.add("is-open");
    if (btn) btn.setAttribute("aria-expanded", "true");
  }

  function wireUIIfReady() {
    if (wired) return true;

    const btn = document.getElementById("themeMenuBtn");
    const picker = document.getElementById("themePicker");
    const menu = document.getElementById("themeMenu");

    // Nếu UI menu không tồn tại, vẫn apply mode nhưng không wire menu
    if (!btn || !picker || !menu) {
      const mode = getSavedMode();
      if (mode === "dark") setEffectiveTheme("dark");
      else if (mode === "light") setEffectiveTheme("light");
      else if (mode === "auto") scheduleAuto();
      else clearEffectiveThemeAttr();
      return false;
    }

    wired = true;

    // initial apply
    applyMode(getSavedMode());

    // open/close menu
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = picker.classList.contains("is-open");
      if (isOpen) closeMenu();
      else openMenu();
    });

    // chọn mode
    menu.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const item = e.target.closest(".theme-menu-item");
      if (!item) return;
      applyMode(item.dataset.mode);
      closeMenu();
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest("#themePicker")) return;
      closeMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    return true;
  }

  function initRobust() {
    // thử wire ngay
    if (wireUIIfReady()) return;

    // chờ header include xong
    const host = document.getElementById("header-container") || document.body;
    const obs = new MutationObserver(() => {
      if (wireUIIfReady()) obs.disconnect();
    });
    obs.observe(host, { childList: true, subtree: true });
  }

  async function initThemeMode() {
    if (window.__AMADAS_THEME_MODE_INITED__) return;
    window.__AMADAS_THEME_MODE_INITED__ = true;
    initRobust();
  }

  // expose cho app.js
  window.amadasThemeModeInit = initThemeMode;

  // auto-run nếu include trực tiếp
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initThemeMode());
  } else {
    initThemeMode();
  }
})();

// // js/theme-mode.js
// (function () {
//   const MODE_KEY = "amadas_theme_mode"; // system | auto | dark | light
//   const root = document.documentElement;

//   let autoTimer = null;
//   let mql = null;
//   let wired = false;

//   function isDaytime(now = new Date()) {
//     const h = now.getHours();
//     return h >= 6 && h < 18; // Light 06:00–18:00
//   }

//   function nextBoundaryDelayMs(now = new Date()) {
//     const d = new Date(now);
//     const h = d.getHours();

//     let next = new Date(d);
//     if (h < 6) next.setHours(6, 0, 0, 0);
//     else if (h < 18) next.setHours(18, 0, 0, 0);
//     else {
//       next.setDate(next.getDate() + 1);
//       next.setHours(6, 0, 0, 0);
//     }
//     return Math.max(1000, next.getTime() - d.getTime());
//   }

//   function getSavedMode() {
//     const saved = localStorage.getItem(MODE_KEY);
//     if (saved === "dark" || saved === "light" || saved === "system" || saved === "auto") return saved;
//     return "system";
//   }

//   function getSystemTheme() {
//     const prefersLight =
//       window.matchMedia &&
//       window.matchMedia("(prefers-color-scheme: light)").matches;
//     return prefersLight ? "light" : "dark";
//   }

//   function updateLogo(theme) {
//     const logo = document.getElementById("brandLogo");
//     if (!logo) return;

//     const darkSrc = logo.getAttribute("data-logo-dark");
//     const lightSrc = logo.getAttribute("data-logo-light");
//     if (!darkSrc || !lightSrc) return;

//     logo.src = (theme === "light") ? lightSrc : darkSrc;
//   }

//   function setEffectiveTheme(theme) {
//     root.setAttribute("data-theme", theme);
//     updateLogo(theme);
//   }

//   function clearEffectiveThemeAttr() {
//     root.removeAttribute("data-theme"); // để CSS prefers-color-scheme tự quyết
//     updateLogo(getSystemTheme());
//   }

//   function stopAutoSchedule() {
//     if (autoTimer) {
//       clearTimeout(autoTimer);
//       autoTimer = null;
//     }
//   }

//   function onSystemChange() {
//     if (getSavedMode() !== "system") return;
//     clearEffectiveThemeAttr();
//     syncMenuChecks("system");
//   }

//   function stopSystemListener() {
//     if (mql && mql.removeEventListener) {
//       mql.removeEventListener("change", onSystemChange);
//     }
//     mql = null;
//   }

//   function startSystemListener() {
//     stopSystemListener();
//     if (!window.matchMedia) return;
//     mql = window.matchMedia("(prefers-color-scheme: light)");
//     if (mql.addEventListener) mql.addEventListener("change", onSystemChange);
//   }

//   function scheduleAuto() {
//     stopAutoSchedule();
//     setEffectiveTheme(isDaytime() ? "light" : "dark");

//     autoTimer = setTimeout(() => {
//       if (getSavedMode() !== "auto") return;
//       scheduleAuto();
//     }, nextBoundaryDelayMs());
//   }

//   function applyMode(mode) {
//     localStorage.setItem(MODE_KEY, mode);

//     stopAutoSchedule();
//     stopSystemListener();

//     if (mode === "dark") {
//       setEffectiveTheme("dark");
//     } else if (mode === "light") {
//       setEffectiveTheme("light");
//     } else if (mode === "auto") {
//       scheduleAuto();
//     } else {
//       clearEffectiveThemeAttr();
//       startSystemListener();
//     }

//     syncMenuChecks(mode);
//   }

//   function syncMenuChecks(mode) {
//     document.querySelectorAll(".theme-menu-item").forEach((b) => {
//       b.setAttribute("aria-checked", String(b.dataset.mode === mode));
//     });
//   }

//   function closeMenu() {
//     const picker = document.getElementById("themePicker");
//     const btn = document.getElementById("themeMenuBtn");
//     if (picker) picker.classList.remove("is-open");
//     if (btn) btn.setAttribute("aria-expanded", "false");
//   }

//   function openMenu() {
//     const picker = document.getElementById("themePicker");
//     const btn = document.getElementById("themeMenuBtn");
//     if (picker) picker.classList.add("is-open");
//     if (btn) btn.setAttribute("aria-expanded", "true");
//   }

//   function wireUIIfReady() {
//     if (wired) return true;

//     const btn = document.getElementById("themeMenuBtn");
//     const picker = document.getElementById("themePicker");
//     const menu = document.getElementById("themeMenu");
//     if (!btn || !picker || !menu) return false;

//     wired = true;

//     // initial apply mode
//     applyMode(getSavedMode());

//     // open/close menu
//     btn.addEventListener("click", (e) => {
//       e.preventDefault();
//       e.stopPropagation(); // CRITICAL: tránh click document đóng ngay
//       const isOpen = picker.classList.contains("is-open");
//       if (isOpen) closeMenu();
//       else openMenu();
//     });

//     // chọn mode
//     menu.addEventListener("click", (e) => {
//       e.preventDefault();
//       e.stopPropagation();
//       const item = e.target.closest(".theme-menu-item");
//       if (!item) return;
//       applyMode(item.dataset.mode);
//       closeMenu();
//     });

//     document.addEventListener("click", (e) => {
//       if (e.target.closest && e.target.closest("#themePicker")) return;
//       closeMenu();
//     });

//     document.addEventListener("keydown", (e) => {
//       if (e.key === "Escape") closeMenu();
//     });

//     return true;
//   }

//   function initRobust() {
//     if (wireUIIfReady()) return;

//     const host = document.getElementById("header-container") || document.body;
//     const obs = new MutationObserver(() => {
//       if (wireUIIfReady()) obs.disconnect();
//     });
//     obs.observe(host, { childList: true, subtree: true });

//     const mode = getSavedMode();
//     if (mode === "dark") setEffectiveTheme("dark");
//     else if (mode === "light") setEffectiveTheme("light");
//     else if (mode === "auto") scheduleAuto();
//     else clearEffectiveThemeAttr();
//   }

//   document.addEventListener("DOMContentLoaded", initRobust);
// })();
