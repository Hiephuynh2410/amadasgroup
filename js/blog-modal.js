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
        lastActive: null,
        lastThumbRect: null,
        lastThumbSrc: "",
        isAnimating: false,
        pending: null,
        draining: false,
        bound: false,
        yearInfo: null,

        // ✅ NEW: guards to stop infinite re-hydrate loops
        hydrating: false,
        tplSig: "",
      });

    state.cfg = {
      blogPageUrl: options.blogPageUrl || "/layout/blog/blog.html",
      inlineYear: Number.isFinite(options.inlineYear) ? options.inlineYear : NaN,
      shareOrigin: options.shareOrigin || window.location.origin,
      heroNewsIds: Array.isArray(options.heroNewsIds) ? options.heroNewsIds : ["post-01", "post-02"],
      templatesTimeout: Number.isFinite(options.templatesTimeout) ? options.templatesTimeout : 12000,
      readyTimeout: Number.isFinite(options.readyTimeout) ? options.readyTimeout : 8000,
    };

    if (!state.bound) {
      bindEvents(state);
      bindLifecycle(state);
      startObserver(state); // ✅ now safe (not body-wide)
      state.bound = true;
    }

    await waitForTemplatesMaybe(state.cfg.templatesTimeout);
    hydrate(state);
  };

  // ✅ FIX 1: lock hydrate (no re-entrant)
  function hydrate(state) {
    if (state.hydrating) return;
    state.hydrating = true;

    try {
      state.templates = getTemplates();
      state.yearInfo = detectYearInfoFromTemplates(state.templates);

      const grid = document.getElementById("blogGrid");
      if (grid) renderCards(state, grid, state.templates);

      renderHeroNewsTicker(state);
      renderHeroInlineNews(state);
      autoOpenFromUrl(state);

      drainPendingOpen(state);
    } finally {
      state.hydrating = false;
    }
  }

  function scheduleHydrate(state) {
    clearTimeout(state.hydrateTimer);
    state.hydrateTimer = setTimeout(() => hydrate(state), 80);
  }

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

  // ✅ FIX 3: DO NOT observe document.body (causes endless loop)
  function startObserver(state) {
    // chỉ observe nơi chứa templates/blog block (tùy bạn đang include ở đâu)
    const mount =
      document.getElementById("templateblog-container") ||
      document.getElementById("templateblog") ||
      document.getElementById("blogGrid") ||
      document.getElementById("heroNews") ||
      null;

    // Nếu trang này không có blog/templates => không observe
    if (!mount) return;

    const mo = new MutationObserver(() => {
      const tpls = document.querySelectorAll("template.blog-post");
      const sig = Array.from(tpls).map((t) => t.id).join("|");

      // chỉ hydrate khi danh sách template đổi
      if (sig !== state.tplSig) {
        state.tplSig = sig;
        scheduleHydrate(state);
      }
    });

    mo.observe(mount, { childList: true, subtree: true });
    state.mo = mo;
  }

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

  function renderCards(state, grid, templates) {
    if (!templates || !templates.length) return;

    const sig = templates.map((t) => t.id).join("|");
    if (grid.dataset.sig === sig) return;
    grid.dataset.sig = sig;

    grid.innerHTML = "";

    const onBlog = isOnBlogPage(state);

    templates.forEach((tpl) => {
      const title = tpl.dataset.title || "Untitled";
      const metaRaw = tpl.dataset.meta || "";
      const cover = tpl.dataset.cover || "";
      const excerpt = tpl.dataset.excerpt || "";
      const postId = tpl.id;

      const metaShown = onBlog ? metaRaw : metaDateToMonth(metaRaw);

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
            <p class="blog-card__meta" title="${escAttr(metaShown)}">${escHtml(metaShown)}</p>
            <span class="blog-card__cta">Read more →</span>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });
  }

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

  // ✅ FIX 2: signature cho hero ticker (không đổi thì không innerHTML lại)
  function renderHeroNewsTicker(state) {
    const heroWrap = document.getElementById("heroNews");
    const heroMarquee = document.getElementById("heroNewsMarquee");
    const heroList = document.getElementById("heroNewsList");
    if (!heroWrap || !heroMarquee || !heroList) return;

    heroWrap.hidden = false;

    const badgeYearEl = document.getElementById("heroNewsBadgeYear");
    if (badgeYearEl) {
      const top2 = getTopYears(state.yearInfo, 2);
      badgeYearEl.textContent = formatTopYearsLabel(top2);
    }

    if (!state.templates || !state.templates.length) {
      const sigLoading = "__loading__";
      if (heroMarquee.dataset.sig === sigLoading && heroList.dataset.sig === sigLoading) return;
      heroMarquee.dataset.sig = sigLoading;
      heroList.dataset.sig = sigLoading;

      heroMarquee.innerHTML = `<div class="hero-news__row"><span class="hero-news__item">Loading announcements…</span></div>`;
      heroList.innerHTML = "";
      return;
    }

    const ids = state.cfg.heroNewsIds || [];
    const found = ids
      .map((id) => document.getElementById(id))
      .filter((tpl) => tpl && tpl.tagName === "TEMPLATE");

    if (!found.length) {
      const sigEmpty = "__empty__";
      if (heroMarquee.dataset.sig === sigEmpty && heroList.dataset.sig === sigEmpty) return;
      heroMarquee.dataset.sig = sigEmpty;
      heroList.dataset.sig = sigEmpty;

      heroMarquee.innerHTML = `<div class="hero-news__row"><span class="hero-news__item">No announcements.</span></div>`;
      heroList.innerHTML = "";
      return;
    }

    const onBlog = isOnBlogPage(state);

    const sig = found
      .map((tpl) => `${tpl.id}|${tpl.dataset.title || ""}|${tpl.dataset.meta || ""}`)
      .join("||");

    if (heroMarquee.dataset.sig === sig && heroList.dataset.sig === sig) return;
    heroMarquee.dataset.sig = sig;
    heroList.dataset.sig = sig;

    const itemsHtml = found
      .map((tpl, idx) => {
        const title = tpl.dataset.title || "Untitled";
        const metaRaw = tpl.dataset.meta || "";
        const metaShown = onBlog ? metaRaw : metaDateToMonth(metaRaw);
        const dot = idx === 0 ? "" : `<span class="hero-news__dot" aria-hidden="true"></span>`;
        return `
          ${dot}
          <span class="hero-news__item" role="link" tabindex="0" data-post-id="${escAttr(tpl.id)}">
            <strong>${escHtml(title)}</strong>
            <span class="hero-news__meta">${metaShown ? "• " + escHtml(metaShown) : ""}</span>
          </span>
        `;
      })
      .join("");

    heroMarquee.innerHTML =
      `<div class="hero-news__row">${itemsHtml}</div>` + `<div class="hero-news__row">${itemsHtml}</div>`;

    heroList.innerHTML = found
      .map((tpl) => {
        const title = tpl.dataset.title || "Untitled";
        const metaRaw = tpl.dataset.meta || "";
        const metaShown = onBlog ? metaRaw : metaDateToMonth(metaRaw);
        return `
          <span class="hero-news__item" role="link" tabindex="0" data-post-id="${escAttr(tpl.id)}">
            <strong>${escHtml(title)}</strong>
            <span class="hero-news__meta">${metaShown ? "• " + escHtml(metaShown) : ""}</span>
          </span>
        `;
      })
      .join("");
  }

  // ✅ FIX 2: signature cho inline news (không đổi thì không innerHTML lại)
  function renderHeroInlineNews(state) {
    const wrap = document.getElementById("heroNewsInline");
    const list = document.getElementById("heroNewsInlineList");
    if (!wrap || !list) return;

    if (!state.templates || !state.templates.length) {
      wrap.hidden = false;

      const sigLoading = "__loading__";
      if (list.dataset.sig === sigLoading) return;
      list.dataset.sig = sigLoading;

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

    const inlineSig = postsAll.map((p) => `${p.id}|${p.title}|${p.meta}`).join("||");
    if (list.dataset.sig === inlineSig) return;
    list.dataset.sig = inlineSig;

    if (!postsAll.length) {
      wrap.hidden = true;
      list.innerHTML = "";
      return;
    }

    const inlineYearEl = document.getElementById("heroNewsInlineYear");
    const onBlog = isOnBlogPage(state);

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
          const metaFirstRaw = String(p.meta).split("•")[0].trim();
          const metaFirstShown = onBlog ? metaFirstRaw : metaFirstToMonth(metaFirstRaw);
          return `
            <button type="button" class="hero-news-inline__item" data-post-id="${escAttr(p.id)}">
              <span class="hero-news-inline__itemTitle">${escHtml(p.title)}</span>
              <span class="hero-news-inline__itemMeta">${escHtml(metaFirstShown)}</span>
            </button>
          `;
        })
        .join("");

      return;
    }

    const top2 = getTopYears(state.yearInfo, 2);
    if (inlineYearEl) inlineYearEl.textContent = formatTopYearsLabel(top2);

    const yearsToShow = top2.slice();
    const groups = new Map();
    for (const y of yearsToShow) groups.set(y, []);

    for (const p of postsAll) {
      if (groups.has(p.year)) groups.get(p.year).push(p);
    }

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
            const metaFirstRaw = String(p.meta).split("•")[0].trim();
            const metaFirstShown = onBlog ? metaFirstRaw : metaFirstToMonth(metaFirstRaw);
            return `
              <button type="button" class="hero-news-inline__item" data-post-id="${escAttr(p.id)}">
                <span class="hero-news-inline__itemTitle">${escHtml(p.title)}</span>
                <span class="hero-news-inline__itemMeta">${escHtml(metaFirstShown)}</span>
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

  function formatTopYearsLabel(topYears = []) {
    const ys = (topYears || []).slice().sort((a, b) => b - a);
    if (!ys.length) return String(new Date().getFullYear());
    if (ys.length === 1) return String(ys[0]);

    const a = ys[0];
    const b = ys[1];
    if (a - b === 1) return `${b}–${a}`;
    return `${a}, ${b}`;
  }

  function extractYearFromMeta(meta = "") {
    const m = String(meta).match(/(\d{4})/);
    return m ? Number(m[1]) : NaN;
  }

  function extractDateFromMeta(meta = "") {
    const first = String(meta).split("•")[0].trim();
    const d = parseDateLoose(first);
    return d ? d : null;
  }

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
    const ghost = createGhost(coverRect, coverEl.currentSrc || coverEl.src || state.lastThumbSrc);

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

  function resolveSharePostId(btn) {
    const modal = document.getElementById("blogModal");
    const inModal = modal && modal.classList.contains("is-open") && modal.contains(btn);
    return (inModal && modal?.dataset?.activePostId) || btn.dataset.postid || modal?.dataset?.activePostId || "";
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
    return !!(dom && dom.modal && dom.panel && dom.coverEl && dom.titleEl && dom.metaEl && dom.excerptEl && dom.bodyEl);
  }

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

  function isOnBlogPage(state) {
    const blogPath = new URL(state.cfg.blogPageUrl, location.origin).pathname.replace(/\/+$/, "");
    const curPath = location.pathname.replace(/\/+$/, "");
    return curPath === blogPath;
  }

  function metaDateToMonth(meta = "") {
    const parts = String(meta).split("•").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return String(meta || "");
    const d = parseDateLoose(parts[0]);
    if (!d) return String(meta || "");
    parts[0] = d.toLocaleString("en-US", { month: "long" });
    return parts.join(" • ");
  }

  function metaFirstToMonth(dateStr = "") {
    const d = parseDateLoose(String(dateStr).trim());
    if (!d) return String(dateStr || "");
    return d.toLocaleString("en-US", { month: "long" });
  }

  function parseDateLoose(s) {
    const raw = String(s || "").trim();
    if (!raw) return null;

    const d1 = new Date(raw);
    if (!isNaN(d1.getTime())) return d1;

    let m = raw.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,)?\s+(\d{4})$/);
    if (m) {
      const mi = monthIndex(m[1]);
      if (mi >= 0) {
        const dd = Number(m[2]);
        const yy = Number(m[3]);
        const d = new Date(yy, mi, dd);
        return isNaN(d.getTime()) ? null : d;
      }
    }

    m = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (m) {
      const dd = Number(m[1]);
      const mi = monthIndex(m[2]);
      const yy = Number(m[3]);
      if (mi >= 0) {
        const d = new Date(yy, mi, dd);
        return isNaN(d.getTime()) ? null : d;
      }
    }

    return null;
  }

  function monthIndex(name) {
    const n = String(name || "").toLowerCase();
    const map = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11,
    };
    return Object.prototype.hasOwnProperty.call(map, n) ? map[n] : -1;
  }

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