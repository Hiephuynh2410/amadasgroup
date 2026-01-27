(() => {
  const BTN_ID = "navToggle";
  const NAV_ID = "siteNav";

  const getEls = () => ({
    btn: document.getElementById(BTN_ID),
    nav: document.getElementById(NAV_ID),
  });

  const setOpen = (btn, nav, open) => {
    nav.classList.toggle("is-open", open);
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
  };

  // Toggle + click outside to close
  document.addEventListener("click", (e) => {
    const { btn, nav } = getEls();
    if (!btn || !nav) return;

    const hitToggle = e.target === btn || e.target.closest(`#${BTN_ID}`);
    if (hitToggle) {
      const open = !nav.classList.contains("is-open");
      setOpen(btn, nav, open);
      return;
    }

    if (!nav.classList.contains("is-open")) return;
    if (nav.contains(e.target)) return;
    setOpen(btn, nav, false);
  });

  // ESC đóng
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const { btn, nav } = getEls();
    if (!btn || !nav) return;
    setOpen(btn, nav, false);
  });
})();
