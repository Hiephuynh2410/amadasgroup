// js/tet.js
(() => {
  "use strict";

  if (window.__AMADAS_TET__) return;
  window.__AMADAS_TET__ = true;

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  const isPhone = () => window.matchMedia("(max-width: 768px)").matches;

  const ASSETS = {
    lanternLeft: "img/holiday/Latern_left.png",
    lanternRight: "img/holiday/Latern_right.png",
    popupImage: "img/holiday/happynewyear.png",
  };

  const IDS = {
    left: "tet-lantern-left",
    right: "tet-lantern-right",
    confetti: "confetti-canvas",

    popup: "tet-popup",
    popupClose: "tet-popup-close",
    popupBackdrop: "tet-popup-backdrop",
  };

  let mounted = false;

  // CHỈ nhớ trong 1 lần load (reload sẽ reset => popup hiện lại)
  let dismissedThisLoad = false;

  function removeIfExists(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function createFixedImage({ id, src, className, wobble = false }) {
    removeIfExists(id);

    const wrap = document.createElement("div");
    wrap.id = id;
    wrap.className = `tet-fixed ${className}`;

    const inner = document.createElement("div");
    inner.className = `tet-inner` + (wobble ? " tet-wobble" : "");

    const img = document.createElement("img");
    img.src = src;
    img.alt = id;
    img.loading = "eager";
    img.decoding = "async";
    img.draggable = false;

    inner.appendChild(img);
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
  }

  // ---------- Decor ----------
  function initDecor() {
    if (!mounted) return;

    if (isPhone()) {
      removeIfExists(IDS.left);
      removeIfExists(IDS.right);
      return;
    }

    createFixedImage({
      id: IDS.left,
      src: ASSETS.lanternLeft,
      className: "tet-lantern-left",
      wobble: !prefersReducedMotion,
    });

    createFixedImage({
      id: IDS.right,
      src: ASSETS.lanternRight,
      className: "tet-lantern-right",
      wobble: !prefersReducedMotion,
    });
  }

  // ---------- Popup (image only) ----------
  function closePopup() {
    const popup = document.getElementById(IDS.popup);
    if (!popup) return;

    dismissedThisLoad = true;
    popup.classList.add("is-hiding");

    window.setTimeout(() => {
      removeIfExists(IDS.popup);
    }, 200);
  }

  function showPopup() {
    if (!mounted) return;
    if (dismissedThisLoad) return;              // đã tắt trong lần load này
    if (document.getElementById(IDS.popup)) return;

    const popup = document.createElement("div");
    popup.id = IDS.popup;
    popup.className = "tet-popup";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    popup.setAttribute("aria-label", "Happy New Year");

    // Backdrop
    const backdrop = document.createElement("div");
    backdrop.id = IDS.popupBackdrop;
    backdrop.className = "tet-popup__backdrop";
    backdrop.addEventListener("click", closePopup);

    // Panel
    const panel = document.createElement("div");
    panel.className = "tet-popup__panel";

    // Image wrap
    const imgWrap = document.createElement("div");
    imgWrap.className = "tet-popup__imageWrap";

    // Close button (góc trái trên hình)
    const closeBtn = document.createElement("button");
    closeBtn.id = IDS.popupClose;
    closeBtn.className = "tet-popup__close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Đóng");
    closeBtn.innerHTML = "✕";
    closeBtn.addEventListener("click", closePopup);

    // Image
    const img = document.createElement("img");
    img.src = ASSETS.popupImage;
    img.alt = "Happy New Year";
    img.loading = "eager";
    img.decoding = "async";
    img.draggable = false;

    imgWrap.appendChild(img);

    panel.appendChild(closeBtn);
    panel.appendChild(imgWrap);

    popup.appendChild(backdrop);
    popup.appendChild(panel);
    document.body.appendChild(popup);

    // ESC to close
    const onKeydown = (e) => {
      if (e.key === "Escape") closePopup();
    };
    window.addEventListener("keydown", onKeydown, { once: true });
  }

  // ---------- Confetti (optional) ----------
  const confetti = {
    canvas: null,
    ctx: null,
    particles: [],
    rafId: null,
    w: 0,
    h: 0,
    dpr: 1,
  };

  function stopConfetti() {
    if (confetti.rafId) cancelAnimationFrame(confetti.rafId);
    confetti.rafId = null;
    confetti.particles = [];
    confetti.ctx = null;
    confetti.canvas = null;
    removeIfExists(IDS.confetti);
  }

  function mount() {
    if (mounted) return;
    mounted = true;

    document.body.classList.add("page-home");

    initDecor();

    //tắtt popup
    // window.setTimeout(() => {
    //   showPopup();
    // }, prefersReducedMotion ? 0 : 180);
  }

  function unmount() {
    if (!mounted) return;
    mounted = false;

    document.body.classList.remove("page-home");

    removeIfExists(IDS.left);
    removeIfExists(IDS.right);
    stopConfetti();

    removeIfExists(IDS.popup);
  }

  function isHomeRoute() {
    const p = (window.location.pathname || "/").replace(/\/+$/, "");
    return p === "" || p === "/" || p.endsWith("/index.html") || p.endsWith("/index");
  }

  function syncToRoute() {
    if (isHomeRoute()) mount();
    else unmount();
  }

  function installLocationChangeHook() {
    const fire = () => window.dispatchEvent(new Event("amadas:routechange"));

    const _push = history.pushState;
    history.pushState = function (...args) {
      const ret = _push.apply(this, args);
      fire();
      return ret;
    };

    const _replace = history.replaceState;
    history.replaceState = function (...args) {
      const ret = _replace.apply(this, args);
      fire();
      return ret;
    };

    window.addEventListener("popstate", fire);
  }

  installLocationChangeHook();

  window.addEventListener("amadas:routechange", syncToRoute);
  window.addEventListener("resize", () => {
    if (!mounted) return;
    initDecor();
  });

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", syncToRoute);
  } else {
    syncToRoute();
  }
})();
