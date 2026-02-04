// js/google-translate-widget.js
(function () {
  "use strict";

  // Chỉ chạy 1 lần trên mỗi page load
  if (window.__AMADAS_GOOGLE_WIDGET_LOADED__) return;
  window.__AMADAS_GOOGLE_WIDGET_LOADED__ = true;

  const STORAGE_LANG = "amadas_lang_google_widget";
  const PAGE_LANG = "en";
  const INCLUDED = "en,vi";

  function waitFor(selector, timeoutMs = 15000) {
    const start = Date.now();
    return new Promise((resolve) => {
      (function tick() {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeoutMs) return resolve(null);
        requestAnimationFrame(tick);
      })();
    });
  }

  function setBtnLabel(lang) {
    const lb = document.getElementById("langBtnLabel");
    if (lb) lb.textContent = (lang || "en").toUpperCase();

    document.querySelectorAll(".lang-menu-item[data-lang]").forEach((btn) => {
      btn.setAttribute("aria-checked", btn.dataset.lang === lang ? "true" : "false");
    });
  }

  function closeMenu() {
    const picker = document.getElementById("langPicker");
    const btn = document.getElementById("langMenuBtn");
    if (picker) picker.classList.remove("is-open");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  // Cookie used by google widget
  function setGoogTransCookie(value) {
    const cookieVal = value
      ? `googtrans=${value}`
      : "googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = `${cookieVal};path=/`;
    document.cookie = `${cookieVal};path=/;domain=${location.hostname}`;
  }

  function triggerCombo(lang) {
    const sel = document.querySelector("select.goog-te-combo");
    if (!sel) return false;
    sel.value = lang;
    sel.dispatchEvent(new Event("change"));
    return true;
  }

  function ensureHiddenMount() {
    // Không để widget phá UI, tạo mount ẩn nếu chưa có
    let el = document.getElementById("google_translate_element");
    if (!el) {
      el = document.createElement("div");
      el.id = "google_translate_element";
      el.style.display = "none";
      document.body.appendChild(el);
    }
    return el;
  }

  function loadGoogleScriptOnce() {
    // Chỉ tạo script 1 lần
    if (document.getElementById("google-translate-script")) return;

    const s = document.createElement("script");
    s.id = "google-translate-script";
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.head.appendChild(s);
  }

  function applyLang(lang) {
    localStorage.setItem(STORAGE_LANG, lang);
    setBtnLabel(lang);
    closeMenu();

    if (lang === "vi") {
      setGoogTransCookie(`/${PAGE_LANG}/vi`);
      // nếu combo chưa có, reload để widget đọc cookie
      if (!triggerCombo("vi")) location.reload();
      return;
    }

    // về EN: reset cookie + reload
    setGoogTransCookie("");
    location.reload();
  }

  // Global callback: chỉ init 1 lần
  window.googleTranslateElementInit = function () {
    if (window.__AMADAS_GOOGLE_WIDGET_INITED__) return;
    window.__AMADAS_GOOGLE_WIDGET_INITED__ = true;

    ensureHiddenMount();

    // eslint-disable-next-line no-undef
    new google.translate.TranslateElement(
      {
        pageLanguage: PAGE_LANG,
        includedLanguages: INCLUDED,
        autoDisplay: false,
      },
      "google_translate_element"
    );

    const saved = localStorage.getItem(STORAGE_LANG) || "en";
    setBtnLabel(saved);

    if (saved === "vi") {
      setGoogTransCookie(`/${PAGE_LANG}/vi`);
      const t = setInterval(() => {
        if (triggerCombo("vi")) clearInterval(t);
      }, 200);
      setTimeout(() => clearInterval(t), 8000);
    }
  };

  async function boot() {
    // Chờ header include xong để có langPicker
    const picker = await waitFor("#langPicker");
    if (!picker) return;

    // Bind toggle menu chỉ 1 lần
    const menuBtn = document.getElementById("langMenuBtn");
    if (menuBtn && !menuBtn.__AMADAS_BOUND__) {
      menuBtn.__AMADAS_BOUND__ = true;
      menuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const isOpen = picker.classList.toggle("is-open");
        menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
    }

    // Click outside
    if (!document.__AMADAS_LANG_OUTSIDE__) {
      document.__AMADAS_LANG_OUTSIDE__ = true;
      document.addEventListener("click", (e) => {
        if (!picker.contains(e.target)) closeMenu();
      });
    }

    // Click menu item
    if (!document.__AMADAS_LANG_PICK__) {
      document.__AMADAS_LANG_PICK__ = true;
      document.addEventListener("click", (e) => {
        const btn = e.target.closest(".lang-menu-item[data-lang]");
        if (!btn) return;
        const lang = btn.dataset.lang;
        if (lang) applyLang(lang);
      });
    }

    ensureHiddenMount();
    loadGoogleScriptOnce();
  }

  boot();
})();
