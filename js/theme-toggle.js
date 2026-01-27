// js/theme-toggle.js
(function () {
  const THEME_KEY = "amadas_theme";
  const root = document.documentElement;

  const SVG_MOON = `<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path>`;
  const SVG_SUN = `
    <circle cx="12" cy="12" r="5"></circle>
    <path d="M12 1v2"></path>
    <path d="M12 21v2"></path>
    <path d="M4.22 4.22l1.42 1.42"></path>
    <path d="M18.36 18.36l1.42 1.42"></path>
    <path d="M1 12h2"></path>
    <path d="M21 12h2"></path>
    <path d="M4.22 19.78l1.42-1.42"></path>
    <path d="M18.36 5.64l1.42-1.42"></path>
  `;

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;

    const prefersLight =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;

    return prefersLight ? "light" : "dark";
  }

  function updateThemeButton(theme) {
    const btn = document.getElementById("themeToggle");
    const icon = document.getElementById("themeIcon");
    if (!btn || !icon) return;

    const isLight = theme === "light";
    btn.setAttribute("aria-pressed", String(isLight));

    if (isLight) {
      icon.innerHTML = SVG_MOON;
      btn.title = "Switch to dark mode";
    } else {
      icon.innerHTML = SVG_SUN;
      btn.title = "Switch to light mode";
    }
  }

  function applyTheme(theme, onThemeChange) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeButton(theme);

    if (typeof onThemeChange === "function") onThemeChange(theme);
  }

  function toggleTheme(onThemeChange) {
    const current = root.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next, onThemeChange);
  }

  function initThemeToggle(onThemeChange) {
    // apply early
    applyTheme(getPreferredTheme(), onThemeChange);

    // click delegation (header inject trễ vẫn bắt được)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("#themeToggle");
      if (!btn) return;
      toggleTheme(onThemeChange);
    });

    // watch injected header để set icon
    if (window.MutationObserver) {
      const obs = new MutationObserver(() => {
        const btn = document.getElementById("themeToggle");
        const icon = document.getElementById("themeIcon");
        if (btn && icon) {
          updateThemeButton(root.getAttribute("data-theme") || getPreferredTheme());
          obs.disconnect();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  // expose global
  window.initThemeToggle = initThemeToggle;
})();
