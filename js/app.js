// js/app.js
(function () {
  "use strict";

  // ✅ Auto-break khi DevTools mở (kể cả mở SAU khi trang đã load)
  (function devtoolsBreakOnOpen() {
    const TH = 160;          // ngưỡng chênh lệch viewport
    const POLL_MS = 200;     // tần suất kiểm tra
    const MAX_MS = 60000;    // chỉ theo dõi 60s (tránh chạy mãi)

    function isDevtoolsOpen() {
      return (
        Math.abs(window.outerWidth - window.innerWidth) > TH ||
        Math.abs(window.outerHeight - window.innerHeight) > TH
      );
    }

    // DevTools mở sẵn lúc load
    if (isDevtoolsOpen()) debugger;

    // DevTools mở sau đó
    const start = Date.now();
    let fired = false;

    const timer = setInterval(() => {
      if (fired) return;

      if (Date.now() - start > MAX_MS) {
        clearInterval(timer);
        return;
      }

      if (isDevtoolsOpen()) {
        fired = true;
        clearInterval(timer);
        debugger; // ✅ mở DevTools là dừng ngay tại đây
      }
    }, POLL_MS);

    window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
  })();

  if (window.__AMADAS_APP_READY__) return;
  window.__AMADAS_APP_READY__ = true;

  /* =========================
   * BOOT: load include.js trước
   * ========================= */
  function getRootPrefixFromPath(pathname) {
    let path = (pathname || "/").split("?")[0].split("#")[0];
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const isFile = last.includes(".");
    if (isFile) parts.pop();
    if (parts.length === 0) return "";
    return Array(parts.length).fill("..").join("/");
  }

  function withRoot(root, rel) {
    return root ? `${root}/${rel}` : rel;
  }

  function absUrl(rel) {
    const root = getRootPrefixFromPath(window.location.pathname);
    return new URL(withRoot(root, rel), window.location.href).toString();
  }

  function loadScriptOnce(id, srcAbs) {
    return new Promise((resolve, reject) => {
      const existed = document.getElementById(id);
      if (existed) return resolve();

      const s = document.createElement("script");
      s.id = id;
      s.src = srcAbs;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + srcAbs));
      document.head.appendChild(s);
    });
  }

  async function boot() {
    // load include.js
    await loadScriptOnce("amadas-include", absUrl("js/include.js"));

    if (typeof window.amadasIncludeInit === "function") {
      try {
        await window.amadasIncludeInit();
      } catch (e) {
        console.error(e);
      }
    }

    // load burger.js
    await loadScriptOnce("amadas-burger", absUrl("js/burger.js"));
    if (typeof window.amadasBurgerInit === "function") {
      try {
        await window.amadasBurgerInit();
      } catch (e) {
        console.error(e);
      }
    }

    // load scroll.js (nếu bạn đã làm bước trước)
    await loadScriptOnce("amadas-scroll", absUrl("js/scroll.js"));

    // load tet.js (chỉ ở home)
    // const p = (window.location.pathname || "/").replace(/\/+$/, "");
    // const isHome = p === "" || p === "/" || p.endsWith("/index.html") || p.endsWith("/index");
    // if (isHome) {
    //   await loadScriptOnce("amadas-tet", absUrl("js/tet.js"));
    //   if (typeof window.amadasTetInit === "function") {
    //     try { await window.amadasTetInit(); } catch (e) { console.error(e); }
    //   }
    // }

    // load theme-toggle.js
    await loadScriptOnce("amadas-theme-mode", absUrl("js/theme-toggle.js"));
    if (typeof window.amadasThemeModeInit === "function") {
      try {
        await window.amadasThemeModeInit();
      } catch (e) {
        console.error(e);
      }
    }
  }

  const root = document.documentElement;

  function waitForHeaderReady(cb) {
    const hasHeaderNow =
      document.getElementById("brandLogo") ||
      document.getElementById("themeToggle") ||
      document.querySelector("#header-container .site-header");

    if (hasHeaderNow) {
      cb();
      return;
    }

    const container =
      document.getElementById("header-container") || document.body;

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

    setTimeout(() => {
      try {
        obs.disconnect();
      } catch (e) {}
      cb();
    }, 5000);
  }

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

    const darkSrc =
      logo.getAttribute("data-logo-dark") || "/img/logo_white.png";
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
    if (!btn) return;

    if (!window.__AMADAS_THEME_INIT__) {
      window.__AMADAS_THEME_INIT__ = true;
      setTheme(getPreferredTheme(), { save: true, onChange: onThemeChange });

      const mq =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)");
      if (mq && !mq.__AMADAS_THEME_MQ_BOUND__) {
        mq.__AMADAS_THEME_MQ_BOUND__ = true;
        mq.addEventListener("change", function () {
          const saved = localStorage.getItem("theme");
          if (!saved)
            setTheme(getPreferredTheme(), {
              save: false,
              onChange: onThemeChange,
            });
        });
      }
    } else {
      const cur = root.getAttribute("data-theme") || getPreferredTheme();
      setLogoByTheme(cur);
    }

    if (!btn.__AMADAS_THEME_BOUND__) {
      btn.__AMADAS_THEME_BOUND__ = true;
      btn.addEventListener("click", function () {
        const cur = root.getAttribute("data-theme") || "dark";
        const next = cur === "dark" ? "light" : "dark";
        setTheme(next, { save: true, onChange: onThemeChange });
      });
    }
  }

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

  function startOnceHeaderExists() {
    bindThemeToggle(() => refreshCursor());
    initCursor(false);

    const currentTheme = root.getAttribute("data-theme") || getPreferredTheme();
    setLogoByTheme(currentTheme);
  }

  function start() {
    waitForHeaderReady(startOnceHeaderExists);
  }

  async function main() {
    try {
      await boot();
    } catch (e) {
      console.error(e);
    }
    start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();


// // js/app.js
// (function () {
//   const root = document.documentElement;

 
//   function waitForHeaderReady(cb) {
//     const hasHeaderNow =
//       document.getElementById("brandLogo") ||
//       document.getElementById("themeToggle") ||
//       document.querySelector("#header-container .site-header");

//     if (hasHeaderNow) {
//       cb();
//       return;
//     }

//     const container = document.getElementById("header-container") || document.body;

//     const obs = new MutationObserver(() => {
//       const ok =
//         document.getElementById("brandLogo") ||
//         document.getElementById("themeToggle") ||
//         document.querySelector("#header-container .site-header");
//       if (ok) {
//         obs.disconnect();
//         cb();
//       }
//     });

//     obs.observe(container, { childList: true, subtree: true });

//     setTimeout(() => {
//       try { obs.disconnect(); } catch (e) {}
//       cb(); 
//     }, 5000);
//   }


//   function getPreferredTheme() {
//     const saved = localStorage.getItem("theme");
//     if (saved === "light" || saved === "dark") return saved;

//     const prefersLight =
//       window.matchMedia &&
//       window.matchMedia("(prefers-color-scheme: light)").matches;

//     return prefersLight ? "light" : "dark";
//   }

//   function setLogoByTheme(theme) {
//     const logo =
//       document.getElementById("brandLogo") ||
//       document.querySelector("img.brand-logo") ||
//       document.querySelector(".brand img");

//     if (!logo) return;

//     const darkSrc = logo.getAttribute("data-logo-dark") || "/img/logo_white.png";
//     const lightSrc = logo.getAttribute("data-logo-light") || "/img/logo.png";

//     const nextSrc = theme === "light" ? lightSrc : darkSrc;
//     if (nextSrc && logo.getAttribute("src") !== nextSrc) {
//       logo.setAttribute("src", nextSrc);
//     }
//   }

//   function setTheme(theme, opts) {
//     opts = opts || {};
//     const save = opts.save !== undefined ? opts.save : true;
//     const onChange = typeof opts.onChange === "function" ? opts.onChange : null;

//     root.setAttribute("data-theme", theme);
//     if (save) localStorage.setItem("theme", theme);

//     const btn = document.getElementById("themeToggle");
//     if (btn) btn.setAttribute("aria-pressed", String(theme === "light"));

//     const themeIcon = document.getElementById("themeIcon");
//     if (themeIcon) {
//       themeIcon.innerHTML =
//         theme === "light"
//           ? '<path d="M12 18a6 6 0 1 0 0-12a6 6 0 0 0 0 12Z"></path><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M4.93 19.07l1.41-1.41"></path><path d="M17.66 6.34l1.41-1.41"></path>'
//           : '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"></path>';
//     }

//     setLogoByTheme(theme);

//     if (onChange) onChange(theme);
//   }

//   function bindThemeToggle(onThemeChange) {
//     const btn = document.getElementById("themeToggle");
//     if (!btn) return; // header chưa có

//     // init 1 lần
//     if (!window.__AMADAS_THEME_INIT__) {
//       window.__AMADAS_THEME_INIT__ = true;
//       setTheme(getPreferredTheme(), { save: true, onChange: onThemeChange });

//       // auto change theo OS nếu user chưa set theme thủ công
//       const mq =
//         window.matchMedia && window.matchMedia("(prefers-color-scheme: light)");
//       if (mq && !mq.__AMADAS_THEME_MQ_BOUND__) {
//         mq.__AMADAS_THEME_MQ_BOUND__ = true;
//         mq.addEventListener("change", function () {
//           const saved = localStorage.getItem("theme");
//           if (!saved) setTheme(getPreferredTheme(), { save: false, onChange: onThemeChange });
//         });
//       }
//     } else {
//       // nếu header mới được include sau, chỉ cần sync logo theo theme hiện tại
//       const cur = root.getAttribute("data-theme") || getPreferredTheme();
//       setLogoByTheme(cur);
//     }

//     // bind click 1 lần cho mỗi nút themeToggle (tránh bind trùng)
//     if (!btn.__AMADAS_THEME_BOUND__) {
//       btn.__AMADAS_THEME_BOUND__ = true;
//       btn.addEventListener("click", function () {
//         const cur = root.getAttribute("data-theme") || "dark";
//         const next = cur === "dark" ? "light" : "dark";
//         setTheme(next, { save: true, onChange: onThemeChange });
//       });
//     }
//   }

//   // =========================
//   // CURSOR (kursor)
//   // =========================
//   function getCursorColor() {
//     const v = getComputedStyle(root).getPropertyValue("--cursor").trim();
//     return v || "#ffffff";
//   }

//   function cleanupOldKursorDom() {
//     document.querySelectorAll('[class*="kursor"]').forEach((el) => el.remove());
//   }

//   function initCursor(force) {
//     if (!window.kursor) return;

//     if (window.__AMADAS_CURSOR__ && !force) return;

//     if (force) {
//       cleanupOldKursorDom();
//       window.__AMADAS_CURSOR__ = false;
//     }

//     window.__AMADAS_CURSOR__ = true;

//     new window.kursor({
//       type: 1,
//       removeDefaultCursor: true,
//       color: getCursorColor(),
//     });
//   }

//   function refreshCursor() {
//     if (!window.kursor) return;
//     initCursor(true);
//   }

//   // =========================
//   // START
//   // =========================
//   function startOnceHeaderExists() {
//     // Theme + Logo + Cursor refresh when theme changes
//     bindThemeToggle(() => refreshCursor());

//     // Cursor init (after theme applied so color correct)
//     initCursor(false);

//     // Ensure logo is correct even if theme already set before header existed
//     const currentTheme = root.getAttribute("data-theme") || getPreferredTheme();
//     setLogoByTheme(currentTheme);
//   }

//   function start() {
//     waitForHeaderReady(startOnceHeaderExists);
//   }

//   if (document.readyState === "loading") {
//     document.addEventListener("DOMContentLoaded", start);
//   } else {
//     start();
//   }
// })();
