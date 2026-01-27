// js/include.js
(() => {
  "use strict";

  if (window.__AMADAS_INCLUDE_READY__) return;
  window.__AMADAS_INCLUDE_READY__ = true;

  /* ====================== BASIC HELPERS ====================== */
  async function loadPartial(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    el.innerHTML = await res.text();
  }

  function getRootPrefixFromPath(pathname) {
    let path = (pathname || "/").split("?")[0].split("#")[0];
    const parts = path.split("/").filter(Boolean);

    const last = parts[parts.length - 1] || "";
    const isFile = last.includes(".");

    if (isFile) parts.pop();
    if (parts.length === 0) return "";
    return Array(parts.length).fill("..").join("/");
  }

  function getRootPrefix() {
    return getRootPrefixFromPath(window.location.pathname);
  }

  function withRoot(root, rel) {
    return root ? `${root}/${rel}` : rel;
  }

  function rewriteHeaderLinks(root) {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const toRoot = (rel) => (root ? `${root}/${rel}` : rel);

    const homeLink = header.querySelector(
      'a.nav-link[href="index.html"], a.nav-link[href="./index.html"]'
    );
    if (homeLink) homeLink.setAttribute("href", toRoot("index.html"));

    const brand = header.querySelector("a.brand");
    if (brand) brand.setAttribute("href", toRoot("index.html#home"));

    const brandImg = header.querySelector("img.brand-logo");
    if (brandImg) {
      const src = brandImg.getAttribute("src") || "";
      if (!src.startsWith("http") && !src.startsWith("/") && !src.startsWith(root)) {
        brandImg.setAttribute("src", toRoot(src));
      }
    }

    header.querySelectorAll('a[href^="layout/"]').forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      if (href.startsWith("http")) return;
      a.setAttribute("href", toRoot(href));
    });

    // anchors (#section) => always go to index.html#section (classic multi-page behavior)
    header.querySelectorAll('a[href^="#"]').forEach((a) => {
      const hash = a.getAttribute("href");
      if (!hash) return;
      a.setAttribute("href", toRoot(`index.html${hash}`));
    });
  }

  /* ====================== ACTIVE NAV (NO SPA) ====================== */
  function normPath(p) {
    p = (p || "").split("?")[0].split("#")[0];
    if (!p.startsWith("/")) p = "/" + p;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);

    // normalize home variants
    if (p === "/index.html" || p === "/index") return "/";
    if (p.endsWith("/index.html")) p = p.slice(0, -11);
    if (p.endsWith("/index")) p = p.slice(0, -6);
    if (p === "") p = "/";
    return p;
  }

  function setActiveNavLink() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const links = Array.from(header.querySelectorAll("a.nav-link"));
    if (links.length === 0) return;

    links.forEach((a) => a.classList.remove("active"));

    const current = normPath(window.location.pathname);

    // match by pathname
    for (const a of links) {
      const href = a.getAttribute("href");
      if (!href) continue;
      if (href.startsWith("#")) continue;

      let targetPath = "";
      try {
        const u = new URL(href, window.location.href);
        targetPath = normPath(u.pathname);
      } catch {
        continue;
      }

      if (targetPath === current) {
        a.classList.add("active");
        return;
      }
    }

    // fallback: if home
    if (current === "/") {
      const home = links.find((a) => (a.getAttribute("href") || "").includes("index"));
      if (home) home.classList.add("active");
    }
  }

  /* ====================== LOAD CONTAINERS ====================== */
  async function loadAllContainers(root) {
    const p = (rel) => withRoot(root, rel);

    // header/footer
    const headerContainer = document.querySelector("#header-container");
    if (headerContainer && !headerContainer.innerHTML.trim()) {
      await loadPartial("#header-container", p("layout/partials/header.html"));
    }

    rewriteHeaderLinks(root);
    setActiveNavLink();

    const footerContainer = document.querySelector("#footer-container");
    if (footerContainer && !footerContainer.innerHTML.trim()) {
      await loadPartial("#footer-container", p("layout/partials/footer.html"));
    }

    // home sections
    const hero = document.querySelector("#hero-container");
    if (hero && !hero.innerHTML.trim())
      await loadPartial("#hero-container", p("layout/partials/hero.html"));

    const project = document.querySelector("#project-container");
    if (project && !project.innerHTML.trim())
      await loadPartial("#project-container", p("layout/partials/project.html"));

    const blog = document.querySelector("#blog-container");
    if (blog && !blog.innerHTML.trim())
      await loadPartial("#blog-container", p("layout/partials/blog.html"));

    const people = document.querySelector("#people-container");
    if (people && !people.innerHTML.trim())
      await loadPartial("#people-container", p("layout/partials/people.html"));

    // team/contact
    const advisor = document.querySelector("#advisor-container");
    if (advisor && !advisor.innerHTML.trim())
      await loadPartial("#advisor-container", p("layout/contact/advisor.html"));

    const core = document.querySelector("#core-container");
    if (core && !core.innerHTML.trim())
      await loadPartial("#core-container", p("layout/contact/coremember.html"));

    const member = document.querySelector("#member-container");
    if (member && !member.innerHTML.trim())
      await loadPartial("#member-container", p("layout/contact/member.html"));

    const colabf = document.querySelector("#colab-container");
    if (colabf && !colabf.innerHTML.trim())
      await loadPartial("#colab-container", p("layout/contact/Collaborators.html"));

    const asslabf = document.querySelector("#assistant-container");
    if (asslabf && !asslabf.innerHTML.trim())
      await loadPartial("#assistant-container", p("layout/contact/assistant.html"));

    // publications
    const jounal = document.querySelector("#jounal-container");
    if (jounal && !jounal.innerHTML.trim())
      await loadPartial("#jounal-container", p("layout/publications/jounal.html"));

    const introJ = document.querySelector("#Introjounal-container");
    if (introJ && !introJ.innerHTML.trim())
      await loadPartial("#Introjounal-container", p("layout/publications/IntroPub.html"));

    const conf = document.querySelector("#conference-container");
    if (conf && !conf.innerHTML.trim())
      await loadPartial("#conference-container", p("layout/publications/conference.html"));
  }

  /* ====================== SCRIPT LOADER (ONCE) ====================== */
  function ensureScriptOnce(id, srcAbs, onload) {
    const existing = document.getElementById(id);
    if (existing) {
      if (typeof onload === "function") {
        if (existing.dataset.loaded === "1") onload();
        else existing.addEventListener("load", onload, { once: true });
      }
      return;
    }

    const s = document.createElement("script");
    s.id = id;
    s.src = srcAbs;
    s.defer = true;

    s.addEventListener(
      "load",
      () => {
        s.dataset.loaded = "1";
        if (typeof onload === "function") {
          try {
            onload();
          } catch {}
        }
      },
      { once: true }
    );

    document.head.appendChild(s);
  }

  function ensureFilterPaperJs() {
    const root = getRootPrefixFromPath(window.location.pathname);
    const srcAbs = new URL(withRoot(root, "js/filterpaper.js"), window.location.href).toString();
    ensureScriptOnce("amadas-filterpaper-js", srcAbs);
  }

  function ensureTetIfHome() {
    const isHome = normPath(window.location.pathname) === "/";
    if (!isHome) return;

    const root = getRootPrefixFromPath(window.location.pathname);
    const tetSrc = new URL(withRoot(root, "js/tet.js"), window.location.href).toString();

    ensureScriptOnce("spa-tet-js", tetSrc, () => {
      if (typeof window.tetInit === "function") {
        try {
          window.tetInit();
        } catch {}
      }
    });

    if (typeof window.tetInit === "function") {
      try {
        window.tetInit();
      } catch {}
    }
  }

  /* ====================== INIT (NO SPA) ====================== */
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const root = getRootPrefix();
      await loadAllContainers(root);

      ensureFilterPaperJs();
      ensureTetIfHome();

      console.log("[AMADAS INCLUDE] ready:", window.location.pathname);
    } catch (err) {
      console.error(err);
    }
  });
})();
