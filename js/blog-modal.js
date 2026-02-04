// blog-modal.js
(function () {
  if (window.amadasBlogModalInit) return;

  const STATE_KEY = "__amadas_blog_modal_state__";

  window.amadasBlogModalInit = async function amadasBlogModalInit(options = {}) {
    await domReady();

    const state =
      window[STATE_KEY] ||
      (window[STATE_KEY] = {
        cfg: {},
        templates: [],
        mo: null,
        hydrateTimer: null,

        // modal animation state
        lastActive: null,
        lastThumbRect: null,
        lastThumbSrc: "",
        isAnimating: false,

        // open queue
        pending: null,
        draining: false,

        // bind guard
        bound: false,

        // ✅ years info
        yearInfo: null,
      });

    state.cfg = {
      blogPageUrl: options.blogPageUrl || "/layout/blog/blog.html",

      // nếu truyền inlineYear (vd 2026) -> chỉ hiện năm đó
      // nếu không truyền -> tự hiện 2 năm gần nhất
      inlineYear: Number.isFinite(options.inlineYear) ? options.inlineYear : NaN,

      shareOrigin: options.shareOrigin || window.location.origin,
      heroNewsIds: Array.isArray(options.heroNewsIds) ? options.heroNewsIds : ["post-01", "post-02"],

      templatesTimeout: Number.isFinite(options.templatesTimeout) ? options.templatesTimeout : 12000,
      readyTimeout: Number.isFinite(options.readyTimeout) ? options.readyTimeout : 8000,
    };

    if (!state.bound) {
      bindEvents(state);
      bindLifecycle(state);
      startObserver(state);
      state.bound = true;
    }

    await waitForTemplatesMaybe(state.cfg.templatesTimeout);
    hydrate(state);
  };

  // ======================
  // HYDRATE
  // ======================
  function hydrate(state) {
    state.templates = getTemplates();
    state.yearInfo = detectYearInfoFromTemplates(state.templates);

    const grid = document.getElementById("blogGrid");
    if (grid) renderCards(grid, state.templates);

    renderHeroNewsTicker(state);
    renderHeroInlineNews(state);
    autoOpenFromUrl(state);

    drainPendingOpen(state);
  }

  function scheduleHydrate(state) {
    clearTimeout(state.hydrateTimer);
    state.hydrateTimer = setTimeout(() => hydrate(state), 80);
  }

  // ======================
  // EVENTS
  // ======================
  function bindEvents(state) {
    document.addEventListener(
      "pointerdown",
      (e) => {
        const closeTarget = e.target.closest('[data-close="true"]');
        if (closeTarget) {
          e.preventDefault();
          requestClose(state);
          return;
        }

        const shareBtn = e.target.closest(".share-facebook");
        if (shareBtn) {
          e.preventDefault();
          e.stopPropagation();
          const postId = resolveSharePostId(shareBtn);
          if (postId) openFacebookComposer(state, postId);
          return;
        }

        const card = e.target.closest(".blog-card");
        if (card) {
          const postId = card.dataset.postId || card.dataset.postid || "";
          if (!postId) return;

          const img = card.querySelector(".blog-card__thumbimg");
          if (img) {
            state.lastThumbRect = img.getBoundingClientRect();
            state.lastThumbSrc = img.currentSrc || img.src || "";
          } else {
            state.lastThumbRect = null;
            state.lastThumbSrc = "";
          }

          queueOpen(state, postId, { fromCard: true });
          return;
        }

        const heroItem = e.target.closest(".hero-news__item");
        if (heroItem && heroItem.dataset.postId) {
          state.lastThumbRect = null;
          state.lastThumbSrc = "";
          queueOpen(state, heroItem.dataset.postId, { fromCard: false });
          return;
        }

        const inlineItem = e.target.closest(".hero-news-inline__item");
        if (inlineItem && inlineItem.dataset.postId) {
          state.lastThumbRect = null;
          state.lastThumbSrc = "";
          queueOpen(state, inlineItem.dataset.postId, { fromCard: false });
          return;
        }
      },
      true
    );

    document.addEventListener(
      "click",
      (e) => {
        const card = e.target.closest(".blog-card");
        const heroItem = e.target.closest(".hero-news__item");
        const inlineItem = e.target.closest(".hero-news-inline__item");
        const closeTarget = e.target.closest('[data-close="true"]');
        const shareBtn = e.target.closest(".share-facebook");

        if (closeTarget || shareBtn || card || heroItem || inlineItem) {
          e.preventDefault();
          return;
        }
      },
      true
    );

    document.addEventListener("keydown", (e) => {
      const modal = document.getElementById("blogModal");
      if (e.key === "Escape" && modal && modal.classList.contains("is-open")) {
        requestClose(state);
      }
    });
  }

  function bindLifecycle(state) {
    window.addEventListener("pageshow", () => scheduleHydrate(state), { passive: true });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) scheduleHydrate(state);
      },
      { passive: true }
    );
  }

  function startObserver(state) {
    const mo = new MutationObserver(() => scheduleHydrate(state));
    mo.observe(document.body, { childList: true, subtree: true });
    state.mo = mo;
  }

  // ======================
  // QUEUE OPEN
  // ======================
  function queueOpen(state, postId, opts = {}) {
    state.pending = { postId, opts, ts: Date.now() };
    drainPendingOpen(state);
  }

  async function drainPendingOpen(state) {
    if (state.draining) return;
    if (!state.pending) return;

    state.draining = true;

    const { readyTimeout, blogPageUrl } = state.cfg;
    const start = performance.now();

    while (performance.now() - start < readyTimeout) {
      if (!state.pending) break;

      if (!document.querySelector("template.blog-post")) {
        await sleep(80);
        continue;
      }

      const { postId, opts } = state.pending;

      const tpl = document.getElementById(postId);
      if (!tpl || tpl.tagName !== "TEMPLATE") {
        await sleep(80);
        continue;
      }

      const dom = getModalDom();
      if (!dom.modal) {
        window.location.href = blogPageUrl + "?post=" + encodeURIComponent(postId);
        state.pending = null;
        break;
      }

      if (!isModalReady(dom)) {
        await sleep(80);
        continue;
      }

      state.pending = null;
      await openById(state, postId, opts);
      break;
    }

    if (state.pending) {
      const { postId } = state.pending;
      state.pending = null;
      window.location.href = state.cfg.blogPageUrl + "?post=" + encodeURIComponent(postId);
    }

    state.draining = false;
  }

  // ======================
  // TEMPLATES
  // ======================
  function getTemplates() {
    return Array.from(document.querySelectorAll("template.blog-post"));
  }

  async function waitForTemplatesMaybe(timeoutMs) {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (document.querySelector("template.blog-post")) return true;
      await sleep(100);
    }
    return false;
  }

  // ======================
  // BLOG GRID
  // ======================
  function renderCards(grid, templates) {
    if (!templates || !templates.length) return;

    const sig = templates.map((t) => t.id).join("|");
    if (grid.dataset.sig === sig) return;
    grid.dataset.sig = sig;

    grid.innerHTML = "";

    templates.forEach((tpl) => {
      const title = tpl.dataset.title || "Untitled";
      const meta = tpl.dataset.meta || "";
      const cover = tpl.dataset.cover || "";
      const excerpt = tpl.dataset.excerpt || "";
      const postId = tpl.id;

      const card = document.createElement("article");
      card.className = "blog-card blog-card--pub";
      card.tabIndex = 0;
      card.dataset.postId = postId;

      card.innerHTML = `
        <div class="blog-card__left">
          <img class="blog-card__thumbimg"
               src="${escAttr(cover)}"
               alt="${escAttr(title)}"
               loading="lazy" />
        </div>
        <div class="blog-card__right">
          <h3 class="blog-card__title" title="${escAttr(title)}">${escHtml(title)}</h3>
          <div class="blog-card__spacer">
            <p class="blog-card__meta" title="${escAttr(meta)}">${escHtml(meta)}</p>
            <span class="blog-card__cta">Read more →</span>
          </div>
          </div>
      `;

      grid.appendChild(card);
    });
  }

  // ======================
  // OPEN BY ID
  // ======================
  async function openById(state, postId, opts = {}) {
    const tpl = document.getElementById(postId);
    if (!tpl || tpl.tagName !== "TEMPLATE") return;

    const dom = getModalDom();
    if (!isModalReady(dom)) return;

    state.lastActive = document.activeElement;

    const animate = !!opts.fromCard && !!state.lastThumbRect;
    await openFromTemplate(state, tpl, {
      animate,
      thumbRect: state.lastThumbRect,
      thumbSrc: state.lastThumbSrc,
      postId,
    });
  }

  async function openFromTemplate(state, tpl, opts = {}) {
    const dom = getModalDom();
    const { modal, panel, coverEl, titleEl, metaEl, excerptEl, bodyEl } = dom;
    if (!isModalReady(dom)) return;

    if (state.isAnimating) return;
    if (modal.classList.contains("is-open")) return;

    const { animate = false, thumbRect = null, thumbSrc = "", postId = tpl.id } = opts;

    const title = tpl.dataset.title || "Untitled";
    const meta = tpl.dataset.meta || "";
    const cover = tpl.dataset.cover || thumbSrc || "";
    const excerpt = tpl.dataset.excerpt || "";

    titleEl.textContent = title;
    metaEl.textContent = meta;
    excerptEl.textContent = excerpt;

    coverEl.src = cover;
    coverEl.alt = title;
    coverEl.style.display = cover ? "" : "none";

    bodyEl.innerHTML = "";
    bodyEl.appendChild(tpl.content.cloneNode(true));

    bodyEl.querySelectorAll(".share-facebook").forEach((b) => {
      b.dataset.postid = postId;
    });

    modal.dataset.activePostId = postId;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("blog-modal-lock");

    hardResetPanelHidden(panel);

    await nextFrame();
    await nextFrame();

    if (animate && thumbRect && coverEl) {
      state.isAnimating = true;
      const ghost = createGhost(thumbRect, thumbSrc || cover);
      const coverRect = coverEl.getBoundingClientRect();

      await animateGhost(ghost, thumbRect, coverRect, {
        fromRadius: 14,
        toRadius: 14,
        duration: 720,
      });

      panel.style.opacity = "1";
      ghost.remove();
      state.isAnimating = false;
    } else {
      panel.style.opacity = "1";
    }

    const closeBtn = modal.querySelector(".blog-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  // ======================
  // AUTO OPEN FROM URL
  // ======================
  function getPostIdFromUrl() {
    const sp = new URLSearchParams(location.search);
    const q = (sp.get("post") || "").trim();
    if (q) return decodeURIComponent(q);

    const h = (location.hash || "").replace("#", "").trim();
    if (h) return decodeURIComponent(h);

    return "";
  }

  function autoOpenFromUrl(state) {
    const postId = getPostIdFromUrl();
    if (!postId) return;

    const tpl = document.getElementById(postId);
    if (!tpl || tpl.tagName !== "TEMPLATE") return;

    if (document.body.dataset.openedUrl === postId) return;
    document.body.dataset.openedUrl = postId;

    queueOpen(state, postId, { fromCard: false });
  }

  // ======================
  // HERO TICKER  (✅ 2 năm gần nhất)
  // ======================
  function renderHeroNewsTicker(state) {
    const heroWrap = document.getElementById("heroNews");
    const heroMarquee = document.getElementById("heroNewsMarquee");
    const heroList = document.getElementById("heroNewsList");
    if (!heroWrap || !heroMarquee || !heroList) return;

    heroWrap.hidden = false;

    // ✅ set year dưới NEW: chỉ 2 năm gần nhất
    const badgeYearEl = document.getElementById("heroNewsBadgeYear");
    if (badgeYearEl) {
      const top2 = getTopYears(state.yearInfo, 2);
      badgeYearEl.textContent = formatTopYearsLabel(top2);
    }

    if (!state.templates || !state.templates.length) {
      heroMarquee.innerHTML = `
        <div class="hero-news__row">
          <span class="hero-news__item">Loading announcements…</span>
        </div>
      `;
      heroList.innerHTML = "";
      return;
    }

    const ids = state.cfg.heroNewsIds || [];
    const found = ids
      .map((id) => document.getElementById(id))
      .filter((tpl) => tpl && tpl.tagName === "TEMPLATE");

    if (!found.length) {
      heroMarquee.innerHTML = `
        <div class="hero-news__row">
          <span class="hero-news__item">No announcements.</span>
        </div>
      `;
      heroList.innerHTML = "";
      return;
    }

    const itemsHtml = found
      .map((tpl, idx) => {
        const title = tpl.dataset.title || "Untitled";
        const meta = tpl.dataset.meta || "";
        const dot = idx === 0 ? "" : `<span class="hero-news__dot" aria-hidden="true"></span>`;
        return `
          ${dot}
          <span class="hero-news__item" role="link" tabindex="0" data-post-id="${escAttr(tpl.id)}">
            <strong>${escHtml(title)}</strong>
            <span class="hero-news__meta">${meta ? "• " + escHtml(meta) : ""}</span>
          </span>
        `;
      })
      .join("");

    heroMarquee.innerHTML =
      `<div class="hero-news__row">${itemsHtml}</div>` +
      `<div class="hero-news__row">${itemsHtml}</div>`;

    heroList.innerHTML = found
      .map((tpl) => {
        const title = tpl.dataset.title || "Untitled";
        const meta = tpl.dataset.meta || "";
        return `
          <span class="hero-news__item" role="link" tabindex="0" data-post-id="${escAttr(tpl.id)}">
            <strong>${escHtml(title)}</strong>
            <span class="hero-news__meta">${meta ? "• " + escHtml(meta) : ""}</span>
          </span>
        `;
      })
      .join("");
  }

  // ======================
  // INLINE NEWS  (✅ 2 năm gần nhất)
  // ======================
  function renderHeroInlineNews(state) {
    const wrap = document.getElementById("heroNewsInline");
    const list = document.getElementById("heroNewsInlineList");
    if (!wrap || !list) return;

    if (!state.templates || !state.templates.length) {
      wrap.hidden = false;
      list.innerHTML = `<div class="hero-news-inline__loading">Loading news…</div>`;
      return;
    }

    const postsAll = state.templates
      .map((tpl) => {
        const title = tpl.dataset.title || "Untitled";
        const meta = tpl.dataset.meta || "";
        const year = extractYearFromMeta(meta);
        const date = extractDateFromMeta(meta);
        return { id: tpl.id, title, meta, year, date };
      })
      .filter((p) => Number.isFinite(p.year));

    if (!postsAll.length) {
      wrap.hidden = true;
      list.innerHTML = "";
      return;
    }

    const inlineYearEl = document.getElementById("heroNewsInlineYear");

    // nếu ép 1 năm bằng options.inlineYear -> giữ behavior cũ
    if (Number.isFinite(state.cfg.inlineYear)) {
      const targetYear = state.cfg.inlineYear;
      if (inlineYearEl) inlineYearEl.textContent = String(targetYear);

      const posts = postsAll.filter((p) => p.year === targetYear);
      posts.sort((a, b) => (a.date && b.date ? b.date - a.date : a.id.localeCompare(b.id)));

      if (!posts.length) {
        wrap.hidden = true;
        list.innerHTML = "";
        return;
      }

      wrap.hidden = false;
      list.innerHTML = posts
        .map((p) => {
          const metaFirst = String(p.meta).split("•")[0].trim();
          return `
            <button type="button"
                    class="hero-news-inline__item"
                    data-post-id="${escAttr(p.id)}">
              <span class="hero-news-inline__itemTitle">${escHtml(p.title)}</span>
              <span class="hero-news-inline__itemMeta">${escHtml(metaFirst)}</span>
            </button>
          `;
        })
        .join("");

      return;
    }

    // ✅ default: chỉ 2 năm gần nhất
    const top2 = getTopYears(state.yearInfo, 2); // sorted desc
    if (inlineYearEl) inlineYearEl.textContent = formatTopYearsLabel(top2);

    const yearsToShow = top2.slice(); // desc
    const groups = new Map();
    for (const y of yearsToShow) groups.set(y, []);

    for (const p of postsAll) {
      if (groups.has(p.year)) groups.get(p.year).push(p);
    }

    // sort each year by date desc
    for (const y of yearsToShow) {
      const arr = groups.get(y);
      arr.sort((a, b) => (a.date && b.date ? b.date - a.date : a.id.localeCompare(b.id)));
    }

    const any = yearsToShow.some((y) => (groups.get(y) || []).length);
    if (!any) {
      wrap.hidden = true;
      list.innerHTML = "";
      return;
    }

    wrap.hidden = false;
    list.innerHTML = yearsToShow
      .map((y) => {
        const arr = groups.get(y) || [];
        if (!arr.length) return "";

        const items = arr
          .map((p) => {
            const metaFirst = String(p.meta).split("•")[0].trim();
            return `
              <button type="button"
                      class="hero-news-inline__item"
                      data-post-id="${escAttr(p.id)}">
                <span class="hero-news-inline__itemTitle">${escHtml(p.title)}</span>
                <span class="hero-news-inline__itemMeta">${escHtml(metaFirst)}</span>
              </button>
            `;
          })
          .join("");

        return `
          <div class="hero-news-inline__group">
            <div class="hero-news-inline__groupYear">${y}</div>
            <div class="hero-news-inline__groupList">${items}</div>
          </div>
        `;
      })
      .join("");
  }

  // ======================
  // YEAR HELPERS (✅ top N years)
  // ======================
  function detectYearInfoFromTemplates(templates = []) {
    const years = (templates || [])
      .map((tpl) => extractYearFromMeta(tpl?.dataset?.meta || ""))
      .filter((y) => Number.isFinite(y));

    const uniq = Array.from(new Set(years));
    uniq.sort((a, b) => b - a);

    if (!uniq.length) {
      const now = new Date().getFullYear();
      return { years: [now], minYear: now, maxYear: now };
    }

    const minYear = Math.min(...uniq);
    const maxYear = Math.max(...uniq);

    return { years: uniq, minYear, maxYear };
  }

  function getTopYears(yearInfo, n = 2) {
    const ys = (yearInfo?.years || []).slice().sort((a, b) => b - a);
    if (!ys.length) return [new Date().getFullYear()];
    return ys.slice(0, Math.max(1, n));
  }

  // format label for top years:
  // - if 2 years consecutive: "2025–2026"
  // - else: "2026, 2024"
  function formatTopYearsLabel(topYears = []) {
    const ys = (topYears || []).slice().sort((a, b) => b - a);
    if (!ys.length) return String(new Date().getFullYear());
    if (ys.length === 1) return String(ys[0]);

    const a = ys[0]; // newest
    const b = ys[1]; // second newest
    if (a - b === 1) return `${b}–${a}`;
    return `${a}, ${b}`;
  }

  function extractYearFromMeta(meta = "") {
    const m = String(meta).match(/(\d{4})/);
    return m ? Number(m[1]) : NaN;
  }

  function extractDateFromMeta(meta = "") {
    const first = String(meta).split("•")[0].trim();
    const d = new Date(first);
    return isNaN(d.getTime()) ? null : d;
  }

  // ======================
  // CLOSE MODAL
  // ======================
  function requestClose(state) {
    const dom = getModalDom();
    if (!dom.modal || !dom.modal.classList.contains("is-open")) return;
    closeModal(state);
  }

  async function closeModal(state) {
    const dom = getModalDom();
    const { modal, panel, coverEl, bodyEl } = dom;
    if (!modal || !panel || !coverEl || !bodyEl) return;
    if (state.isAnimating) return;

    if (!state.lastThumbRect) return finalizeClose(state);

    state.isAnimating = true;

    const coverRect = coverEl.getBoundingClientRect();
    const ghost = createGhost(
      coverRect,
      coverEl.currentSrc || coverEl.src || state.lastThumbSrc
    );

    panel.style.opacity = "0";

    await animateGhost(ghost, coverRect, state.lastThumbRect, {
      fromRadius: 14,
      toRadius: 14,
      duration: 520,
    });

    ghost.remove();
    state.isAnimating = false;
    finalizeClose(state);
  }

  function finalizeClose(state) {
    const dom = getModalDom();
    const { modal, panel, bodyEl } = dom;
    if (!modal || !panel || !bodyEl) return;

    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("blog-modal-lock");
    bodyEl.innerHTML = "";
    hardResetPanelHidden(panel);

    if (state.lastActive && typeof state.lastActive.focus === "function") {
      state.lastActive.focus();
    }
  }

  function hardResetPanelHidden(panel) {
    panel.style.transition = "none";
    panel.style.transform = "translate(-50%, -50%)";
    panel.style.borderRadius = "18px";
    panel.style.opacity = "0";
    panel.getBoundingClientRect();
    panel.style.transition = "";
  }

  // ======================
  // SHARE FACEBOOK
  // ======================
  function resolveSharePostId(btn) {
    const modal = document.getElementById("blogModal");
    const inModal = modal && modal.classList.contains("is-open") && modal.contains(btn);
    return (
      (inModal && modal?.dataset?.activePostId) ||
      btn.dataset.postid ||
      modal?.dataset?.activePostId ||
      ""
    );
  }

  function getTplByPostId(postId) {
    const tpl = document.getElementById(postId);
    if (!tpl || tpl.tagName !== "TEMPLATE") return null;
    return tpl;
  }

  function buildShareUrl(state, postId) {
    return state.cfg.shareOrigin + "/api/share/" + encodeURIComponent(postId);
  }

  function buildQuote(postId) {
    const tpl = getTplByPostId(postId);
    const title = tpl?.dataset?.title?.trim() || "AMaDaS Blog";
    const excerpt = tpl?.dataset?.excerpt?.trim() || "";
    const meta = tpl?.dataset?.meta?.trim() || "";

    const lines = [];
    lines.push(title);
    if (meta) lines.push(meta);
    if (excerpt) lines.push("", excerpt);

    const quote = lines.join("\n").trim();
    return quote.length > 600 ? quote.slice(0, 600) + "…" : quote;
  }

  function openFacebookComposer(state, postId) {
    const shareUrl = buildShareUrl(state, postId);
    const quote = buildQuote(postId);

    const fb =
      "https://www.facebook.com/sharer/sharer.php?u=" +
      encodeURIComponent(shareUrl) +
      "&quote=" +
      encodeURIComponent(quote);

    window.open(fb, "fbshare", "width=980,height=720,noopener,noreferrer");
  }

  // ======================
  // MODAL DOM
  // ======================
  function getModalDom() {
    return {
      modal: document.getElementById("blogModal"),
      panel: document.getElementById("modalPanel"),
      coverEl: document.getElementById("modalCover"),
      titleEl: document.getElementById("modalTitle"),
      metaEl: document.getElementById("modalMeta"),
      excerptEl: document.getElementById("modalExcerpt"),
      bodyEl: document.getElementById("modalBody"),
    };
  }

  function isModalReady(dom) {
    return !!(
      dom &&
      dom.modal &&
      dom.panel &&
      dom.coverEl &&
      dom.titleEl &&
      dom.metaEl &&
      dom.excerptEl &&
      dom.bodyEl
    );
  }

  // ======================
  // GHOST ANIMATION
  // ======================
  function createGhost(rect, src) {
    const img = document.createElement("img");
    img.className = "blog-ghost";
    img.src = src;
    img.style.left = `${rect.left}px`;
    img.style.top = `${rect.top}px`;
    img.style.width = `${rect.width}px`;
    img.style.height = `${rect.height}px`;
    document.body.appendChild(img);
    return img;
  }

  function animateGhost(el, fromRect, toRect, opts) {
    const { duration, fromRadius, toRadius } = opts;
    const dx = toRect.left - fromRect.left;
    const dy = toRect.top - fromRect.top;
    const sx = toRect.width / fromRect.width;
    const sy = toRect.height / fromRect.height;

    const anim = el.animate(
      [
        { transform: "translate(0px,0px) scale(1,1)", borderRadius: `${fromRadius}px`, opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, borderRadius: `${toRadius}px`, opacity: 1 },
      ],
      { duration, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
    );

    return new Promise((resolve) => {
      anim.onfinish = () => resolve();
      anim.oncancel = () => resolve();
    });
  }

  // ======================
  // HELPERS
  // ======================
  function escHtml(s) {
    return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function escAttr(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function nextFrame() {
    return new Promise((r) => requestAnimationFrame(() => r()));
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function domReady() {
    if (document.readyState === "loading") {
      return new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));
    }
    return Promise.resolve();
  }
})();
