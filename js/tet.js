// js/tet.js
(() => {
  "use strict";

  if (window.__AMADAS_TET_READY__) return;
  window.__AMADAS_TET_READY__ = true;

  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  const isPhone = () => window.matchMedia("(max-width: 768px)").matches;

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

  function asset(rel) {
    const root = getRootPrefixFromPath(window.location.pathname);
    return withRoot(root, rel);
  }

  const IDS = {
    left: "tet-lantern-left",
    right: "tet-lantern-right",
    confetti: "confetti-canvas",

    popup: "tet-popup",
    popupClose: "tet-popup-close",
    popupBackdrop: "tet-popup-backdrop",
  };

  let mounted = false;
  let dismissedThisLoad = false;
    // ====== TET SFX (mp3) ======
  const TET_SFX_SRC = asset("img/audio/tieng_trong_mua_lan-www_tiengdong_com.mp3"); // <-- đổi đường dẫn mp3 của bạn ở đây
  const TET_SFX_KEY = "AMADAS_TET_SFX_PLAYED";

  let tetAudio = null;

  function getTetAudio() {
    if (tetAudio) return tetAudio;
    tetAudio = new Audio(TET_SFX_SRC);
    tetAudio.preload = "auto";
    tetAudio.loop = false;
    tetAudio.volume = 0.9; // chỉnh âm lượng
    return tetAudio;
  }

  function markSfxPlayed() {
    try { sessionStorage.setItem(TET_SFX_KEY, "1"); } catch {}
  }

  function hasPlayedSfx() {
    try { return sessionStorage.getItem(TET_SFX_KEY) === "1"; } catch { return false; }
  }

  function armPlayOnUserGesture() {
    const handler = async () => {
      try {
        const a = getTetAudio();
        a.currentTime = 0;
        await a.play();

        // dừng sau 5 giây
        window.setTimeout(() => {
          try { a.pause(); a.currentTime = 0; } catch {}
        }, 5000);

        markSfxPlayed();
      } catch {}

      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("touchstart", handler, true);
    };

    window.addEventListener("pointerdown", handler, true);
    window.addEventListener("keydown", handler, true);
    window.addEventListener("touchstart", handler, true);
  }


    async function playTetSfxOnceOnEnter() {
    if (!mounted) return;
    if (hasPlayedSfx()) return;

    try {
      const a = getTetAudio();
      a.currentTime = 0;
      await a.play();

      window.setTimeout(() => {
        try { a.pause(); a.currentTime = 0; } catch {}
      }, 5000);

      markSfxPlayed();
    } catch {
      armPlayOnUserGesture();
    }
  }


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

  function initDecor() {
    if (!mounted) return;

    if (isPhone()) {
      removeIfExists(IDS.left);
      removeIfExists(IDS.right);
      return;
    }

    createFixedImage({
      id: IDS.left,
      src: asset("img/holiday/Rev02ConLan_T.png"),
      className: "tet-lantern-left",
      wobble: !prefersReducedMotion,
    });

    createFixedImage({
      id: IDS.right,
      src: asset("img/holiday/Rev02ConLan_P.png"),
      className: "tet-lantern-right",
      wobble: !prefersReducedMotion,
    });
  }

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
    if (dismissedThisLoad) return;
    if (document.getElementById(IDS.popup)) return;

    const popup = document.createElement("div");
    popup.id = IDS.popup;
    popup.className = "tet-popup";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    popup.setAttribute("aria-label", "Happy New Year");

    const backdrop = document.createElement("div");
    backdrop.id = IDS.popupBackdrop;
    backdrop.className = "tet-popup__backdrop";
    backdrop.addEventListener("click", closePopup);

    const panel = document.createElement("div");
    panel.className = "tet-popup__panel";

    const imgWrap = document.createElement("div");
    imgWrap.className = "tet-popup__imageWrap";

    const closeBtn = document.createElement("button");
    closeBtn.id = IDS.popupClose;
    closeBtn.className = "tet-popup__close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Đóng");
    closeBtn.innerHTML = "✕";
    closeBtn.addEventListener("click", closePopup);

    const img = document.createElement("img");
    img.src = asset("img/holiday/happynewyear.png");
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

    const onKeydown = (e) => {
      if (e.key === "Escape") closePopup();
    };
    window.addEventListener("keydown", onKeydown, { once: true });
  }

  // confetti placeholder (bạn chưa dùng thì giữ nguyên)
  const confetti = { rafId: null, particles: [] };

  function stopConfetti() {
    if (confetti.rafId) cancelAnimationFrame(confetti.rafId);
    confetti.rafId = null;
    confetti.particles = [];
    removeIfExists(IDS.confetti);
  }

  function mount() {
    if (mounted) return;
    mounted = true;

    document.body.classList.add("page-home");
    initDecor();

    // nếu muốn bật popup lại thì mở dòng này
    // window.setTimeout(() => showPopup(), prefersReducedMotion ? 0 : 180);
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
    if (window.__AMADAS_TET_HOOKED__) return;
    window.__AMADAS_TET_HOOKED__ = true;

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

  async function initTet() {
    if (window.__AMADAS_TET_INITED__) return;
    window.__AMADAS_TET_INITED__ = true;

    installLocationChangeHook();

    window.addEventListener("amadas:routechange", syncToRoute);
    window.addEventListener("resize", () => {
      if (!mounted) return;
      initDecor();
    });

    syncToRoute();
  }

  // expose để app.js gọi
  window.amadasTetInit = initTet;

  // auto-run nếu ai đó include trực tiếp
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => initTet());
  } else {
    initTet();
  }
})();