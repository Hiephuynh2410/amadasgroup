// js/burger.js
(() => {
  "use strict";

  const BTN_ID = "navToggle";
  const NAV_ID = "siteNav";
  const BODY_OPEN_CLASS = "nav-open"; // optional: add CSS to lock scroll

  function getEls() {
    return {
      btn: document.getElementById(BTN_ID),
      nav: document.getElementById(NAV_ID),
    };
  }

  function setOpen(btn, nav, open) {
    if (!btn || !nav) return;

    nav.classList.toggle("is-open", open);
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-controls", NAV_ID);

    // optional: lock page scroll when menu open (mobile UX)
    document.body.classList.toggle(BODY_OPEN_CLASS, open);
  }

  function isOpen(nav) {
    return !!nav && nav.classList.contains("is-open");
  }

  function closeIfOpen() {
    const { btn, nav } = getEls();
    if (!btn || !nav) return;
    if (!isOpen(nav)) return;
    setOpen(btn, nav, false);
  }

  function bindOnce() {
    // tránh bind trùng
    if (window.__AMADAS_BURGER_BOUND__) return;
    window.__AMADAS_BURGER_BOUND__ = true;

    // Click toggle + click outside
    document.addEventListener("click", (e) => {
      const { btn, nav } = getEls();
      if (!btn || !nav) return;

      const hitToggle = e.target === btn || e.target.closest(`#${BTN_ID}`);
      if (hitToggle) {
        const open = !isOpen(nav);
        setOpen(btn, nav, open);
        return;
      }

      // nếu đang mở: click ngoài nav => đóng
      if (!isOpen(nav)) return;
      if (nav.contains(e.target)) return;
      setOpen(btn, nav, false);
    });

    // ESC đóng
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeIfOpen();
    });

    // Click vào link trong nav => đóng (mobile)
    document.addEventListener("click", (e) => {
      const { nav } = getEls();
      if (!nav) return;
      if (!isOpen(nav)) return;

      const a = e.target.closest(`#${NAV_ID} a`);
      if (a) {
        // Cho phép anchor/route chạy, nhưng đóng menu ngay
        closeIfOpen();
      }
    });

    // Resize: nếu chuyển sang desktop thì đóng
    window.addEventListener(
      "resize",
      () => {
        const { nav } = getEls();
        if (!nav) return;
        if (window.matchMedia("(min-width: 769px)").matches) {
          closeIfOpen();
        }
      },
      { passive: true }
    );
  }

  function waitForHeader(cb) {
    const okNow = () => {
      const { btn, nav } = getEls();
      return !!btn && !!nav;
    };
    if (okNow()) return cb();

    const container = document.getElementById("header-container") || document.body;
    const obs = new MutationObserver(() => {
      if (okNow()) {
        obs.disconnect();
        cb();
      }
    });

    obs.observe(container, { childList: true, subtree: true });

    // fallback timeout
    setTimeout(() => {
      try { obs.disconnect(); } catch {}
      cb();
    }, 5000);
  }

  async function initBurger() {
    if (window.__AMADAS_BURGER_INIT__) return;
    window.__AMADAS_BURGER_INIT__ = true;

    waitForHeader(() => {
      // Khi header đã có => set trạng thái ban đầu
      const { btn, nav } = getEls();
      if (btn && nav) setOpen(btn, nav, false);

      // bind event global 1 lần
      bindOnce();
    });
  }

  // expose để app.js gọi nếu muốn
  window.amadasBurgerInit = initBurger;

  // auto-run nếu burger.js được include trực tiếp
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initBurger());
  } else {
    initBurger();
  }
})();

// (() => {
//   const BTN_ID = "navToggle";
//   const NAV_ID = "siteNav";

//   const getEls = () => ({
//     btn: document.getElementById(BTN_ID),
//     nav: document.getElementById(NAV_ID),
//   });

//   const setOpen = (btn, nav, open) => {
//     nav.classList.toggle("is-open", open);
//     btn.classList.toggle("is-open", open);
//     btn.setAttribute("aria-expanded", String(open));
//   };

//   // Toggle + click outside to close
//   document.addEventListener("click", (e) => {
//     const { btn, nav } = getEls();
//     if (!btn || !nav) return;

//     const hitToggle = e.target === btn || e.target.closest(`#${BTN_ID}`);
//     if (hitToggle) {
//       const open = !nav.classList.contains("is-open");
//       setOpen(btn, nav, open);
//       return;
//     }

//     if (!nav.classList.contains("is-open")) return;
//     if (nav.contains(e.target)) return;
//     setOpen(btn, nav, false);
//   });

//   // ESC đóng
//   document.addEventListener("keydown", (e) => {
//     if (e.key !== "Escape") return;
//     const { btn, nav } = getEls();
//     if (!btn || !nav) return;
//     setOpen(btn, nav, false);
//   });
// })();
