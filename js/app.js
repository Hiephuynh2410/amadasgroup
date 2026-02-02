// js/app.js
(function () {
  "use strict";

  const __AMADAS_URL__ = new URL(window.location.href);
  // ẩn này để truy cập devtoool
  // const __AMADAS_LOCK__ = __AMADAS_URL__.searchParams.get("unlock") !== "1";

  // State
  let __AMADAS_DEVTOOLS_OPEN__ = false;
  let __AMADAS_OVERLAY_VISIBLE__ = false;

  function domReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else cb();
  }

  function ensureWarningOverlay() {
    if (!document.body) return;

    if (document.getElementById("amadasWarningOverlay")) return;

    const style = document.createElement("style");
    style.id = "amadasWarningOverlayStyle";
    style.textContent = `
      #amadasWarningOverlay{
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(0,0,0,0.72);
        backdrop-filter: blur(6px);
      }
      #amadasWarningOverlay .amadas-card{
        width: min(560px, 100%);
        border-radius: 16px;
        padding: 18px 18px 14px;
        background: rgba(20,20,20,0.95);
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 10px 30px rgba(0,0,0,0.45);
        color: #fff;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      #amadasWarningOverlay .amadas-title{
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 8px;
      }
      #amadasWarningOverlay .amadas-desc{
        font-size: 14px;
        line-height: 1.45;
        opacity: 0.92;
        margin: 0 0 12px;
      }
      #amadasWarningOverlay .amadas-reason{
        font-size: 12px;
        opacity: 0.75;
        margin: 0 0 14px;
        word-break: break-word;
      }
      #amadasWarningOverlay .amadas-actions{
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      #amadasWarningOverlay .amadas-btn{
        border: 0;
        border-radius: 12px;
        padding: 10px 12px;
        cursor: pointer;
        font-size: 14px;
      }
      #amadasWarningOverlay .amadas-btn.primary{
        background: #ffffff;
        color: #111;
        font-weight: 700;
      }
      #amadasWarningOverlay .amadas-btn.ghost{
        background: transparent;
        color: #fff;
        border: 1px solid rgba(255,255,255,0.18);
      }
      #amadasWarningOverlay .amadas-note{
        margin-top: 8px;
        font-size: 12px;
        opacity: .75;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "amadasWarningOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="amadas-card">
        <div class="amadas-title">Cảnh báo</div>
        <div class="amadas-desc">
          Hành động này đang bị hạn chế để bảo vệ nội dung. Vui lòng dừng thao tác bị chặn hoặc đóng DevTools.
        </div>
        <div class="amadas-reason" id="amadasWarningReason">Lý do: —</div>
        <div class="amadas-actions">
          <button class="amadas-btn ghost" id="amadasWarnClose">Đóng</button>
          <button class="amadas-btn primary" id="amadasWarnReload">Tải lại trang</button>
        </div>
        <div class="amadas-note" id="amadasWarnNote"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // click ngoài card => đóng (nhưng nếu devtools vẫn mở, overlay sẽ bật lại)
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) hideWarningOverlay();
    });

    const btnClose = document.getElementById("amadasWarnClose");
    const btnReload = document.getElementById("amadasWarnReload");
    if (btnClose) btnClose.addEventListener("click", hideWarningOverlay);
    if (btnReload) btnReload.addEventListener("click", () => window.location.reload());
  }

  function showWarningOverlay(reason) {
    try {
      ensureWarningOverlay();
      const overlay = document.getElementById("amadasWarningOverlay");
      const reasonEl = document.getElementById("amadasWarningReason");
      const noteEl = document.getElementById("amadasWarnNote");

      if (reasonEl) reasonEl.textContent = "Lý do: " + (reason || "—");

      if (noteEl) {
        noteEl.textContent = __AMADAS_LOCK__
          ? ""
          : "Đang ở chế độ debug (unlock=1).";
      }

      if (overlay) overlay.style.display = "flex";
      __AMADAS_OVERLAY_VISIBLE__ = true;
    } catch (e) {}
  }

  function hideWarningOverlay() {
    const overlay = document.getElementById("amadasWarningOverlay");
    if (overlay) overlay.style.display = "none";
    __AMADAS_OVERLAY_VISIBLE__ = false;
  }

  function isEditableTarget(target) {
    if (!target) return false;
    const el = target.closest
      ? target.closest("input, textarea, select, [contenteditable='true']")
      : null;
    return !!el;
  }

  
  function isDevtoolsHotkey(e) {
    const key = (e.key || "").toLowerCase();
    const code = (e.code || "").toLowerCase();
    const kc = e.keyCode;

    // F12 (Fn+F12 thường vẫn ra F12)
    if (key === "f12" || code === "f12" || kc === 123) return true;

    // Ctrl + Shift + I/J/C/K
    if (e.ctrlKey && e.shiftKey && ["i", "j", "c", "k"].includes(key)) return true;
    if (e.ctrlKey && e.shiftKey && [73, 74, 67, 75].includes(kc)) return true;

    // Cmd + Opt + I/J/C (macOS)
    if (e.metaKey && e.altKey && ["i", "j", "c"].includes(key)) return true;

    return false;
  }

  function installKeyGuards() {
    if (window.jQuery && typeof window.jQuery === "function") {
      window.jQuery(document).keydown(function (event) {
        if (!__AMADAS_LOCK__) return;
        if (event.keyCode == 123) {
          showWarningOverlay("Đã chặn phím F12.");
          return false;
        } else if (event.ctrlKey && event.shiftKey && event.keyCode == 73) {
          showWarningOverlay("Đã chặn phím Ctrl+Shift+I.");
          return false;
        }
      });
    }

    document.addEventListener(
      "keydown",
      function (e) {
        if (!__AMADAS_LOCK__) return;

        if (isEditableTarget(e.target)) {
        }

        // Chặn DevTools hotkeys
        if (isDevtoolsHotkey(e)) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          showWarningOverlay("Phím tắt DevTools đã bị chặn.");
          return false;
        }

        // Context Menu key (Windows keyboards)
        if (e.key === "ContextMenu") {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          showWarningOverlay("Context Menu đã bị chặn.");
          return false;
        }

        // Shift + F10
        if (e.shiftKey && (e.key === "F10" || e.code === "F10")) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          showWarningOverlay("Shift+F10 đã bị chặn.");
          return false;
        }
      },
      { capture: true }
    );
  }

  function installRightClickGuard() {
    document.addEventListener(
      "contextmenu",
      function (e) {
        if (!__AMADAS_LOCK__) return;
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        showWarningOverlay("Chuột phải đã bị vô hiệu hóa.");
      },
      { capture: true }
    );

    document.addEventListener(
      "auxclick",
      function (e) {
        if (!__AMADAS_LOCK__) return;
        if (e.button === 2 && !isEditableTarget(e.target)) {
          e.preventDefault();
          e.stopPropagation();
          showWarningOverlay("Chuột phải đã bị vô hiệu hóa.");
        }
      },
      { capture: true }
    );
  }

  function installDevtoolsDetect() {
    if (!__AMADAS_LOCK__) return;

    const TH = 160;
    const POLL_MS = 300;

    function isDevtoolsOpen() {
      return (
        Math.abs(window.outerWidth - window.innerWidth) > TH ||
        Math.abs(window.outerHeight - window.innerHeight) > TH
      );
    }

    function tick() {
      const open = isDevtoolsOpen();
      if (open && !__AMADAS_DEVTOOLS_OPEN__) {
        __AMADAS_DEVTOOLS_OPEN__ = true;
        showWarningOverlay("DevTools đang mở. Vui lòng đóng để tiếp tục.");
      } else if (!open && __AMADAS_DEVTOOLS_OPEN__) {
        __AMADAS_DEVTOOLS_OPEN__ = false;
        // nếu overlay đang hiện chỉ vì devtools -> tắt
        if (__AMADAS_OVERLAY_VISIBLE__) hideWarningOverlay();
      } else if (open && __AMADAS_DEVTOOLS_OPEN__) {
        // Nếu devtools vẫn mở mà user bấm “Đóng”, overlay sẽ bật lại
        if (!__AMADAS_OVERLAY_VISIBLE__) {
          showWarningOverlay("DevTools đang mở. Vui lòng đóng để tiếp tục.");
        }
      }
    }

    // chạy ngay + poll
    tick();
    const timer = setInterval(tick, POLL_MS);
    window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
    window.addEventListener("focus", tick);
    window.addEventListener("resize", tick);
  }

  /* =========================================================
   * KHỞI TẠO GUARD SỚM (ngay khi file chạy)
   * ========================================================= */
  domReady(() => {
    ensureWarningOverlay();
    hideWarningOverlay();

    installKeyGuards();
    installRightClickGuard();
    installDevtoolsDetect();
  });

  // =========================
  // GUARD: tránh init nhiều lần (phần app chính)
  // =========================
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
  await loadScriptOnce("amadas-include", absUrl("js/include.js"));
  if (typeof window.amadasIncludeInit === "function") {
    try { await window.amadasIncludeInit(); } catch (e) { console.error(e); }
  }

  await loadScriptOnce("amadas-burger", absUrl("js/burger.js"));
  if (typeof window.amadasBurgerInit === "function") {
    try { await window.amadasBurgerInit(); } catch (e) { console.error(e); }
  }

  await loadScriptOnce("amadas-scroll", absUrl("js/scroll.js"));

  await loadScriptOnce("amadas-tet", absUrl("js/tet.js"));
  if (typeof window.amadasTetInit === "function") {
    try { await window.amadasTetInit(); } catch (e) { console.error(e); }
  }

  await loadScriptOnce("amadas-theme-mode", absUrl("js/theme-toggle.js"));
  if (typeof window.amadasThemeModeInit === "function") {
    try { await window.amadasThemeModeInit(); } catch (e) { console.error(e); }
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
      window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;

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
    if (!btn) return;

    if (!window.__AMADAS_THEME_INIT__) {
      window.__AMADAS_THEME_INIT__ = true;
      setTheme(getPreferredTheme(), { save: true, onChange: onThemeChange });

      const mq =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: light)");
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
