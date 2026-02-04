document.addEventListener("DOMContentLoaded", async () => {
  await waitForIncludes();

  // ===== DOM =====
  const grid  = document.getElementById("blogGrid");     // chỉ có ở trang blog grid
  const modal = document.getElementById("blogModal");    // popup modal
  const panel = document.getElementById("modalPanel");

  const coverEl   = document.getElementById("modalCover");
  const titleEl   = document.getElementById("modalTitle");
  const metaEl    = document.getElementById("modalMeta");
  const excerptEl = document.getElementById("modalExcerpt");
  const bodyEl    = document.getElementById("modalBody");

  // hero ticker
  const heroWrap    = document.getElementById("heroNews");
  const heroMarquee = document.getElementById("heroNewsMarquee");
  const heroList    = document.getElementById("heroNewsList");

  // state
  let templates = [];
  let lastActive = null;
  let lastThumbRect = null;
  let lastThumbSrc = "";
  let isAnimating = false;

  const HERO_NEWS_IDS = ["post-01", "post-02"];

  console.group("[BLOG] init");
  console.log("path:", location.pathname);
  console.log("grid:", !!grid, "modal:", !!modal, "panel:", !!panel);
  console.log("heroWrap:", !!heroWrap, "heroMarquee:", !!heroMarquee, "heroList:", !!heroList);
  console.log("HERO_NEWS_IDS:", HERO_NEWS_IDS);
  console.groupEnd();

  // 1) đợi templates (quan trọng: Home phải include templateblog.html)
  templates = await waitForTemplates(12000);

  console.group("[BLOG] templates");
  console.log("count:", templates.length);
  console.log("ids:", templates.map(t => t.id));
  console.groupEnd();

  // 2) render blog cards nếu có grid
  if (grid && templates.length) renderCards();

  // 3) render ticker
  renderHeroNewsTicker(HERO_NEWS_IDS);

  // 4) auto open theo URL (?post=... hoặc #post-...)
  autoOpenFromUrl();

  // 5) observe changes
  observeTemplateChanges();

  // ======================
  // INCLUDE WAIT
  // ======================
  async function waitForIncludes(timeoutMs = 8000) {
    const start = performance.now();

    if (typeof includePartials === "function") {
      try { await includePartials(); }
      catch (e) { console.warn("[INCLUDE] includePartials error:", e); }
    } else {
      console.warn("[INCLUDE] includePartials() not found. Ensure app.js loaded before blog-modal.js");
    }

    while (performance.now() - start < timeoutMs) {
      const tplCount = document.querySelectorAll("template.blog-post").length;
      const heroOk = !!document.getElementById("heroNews");
      if (heroOk || tplCount > 0) return true;
      await sleep(80);
    }
    console.warn("[INCLUDE] timeout. continue anyway.");
    return false;
  }

  // ======================
  // TEMPLATES
  // ======================
  function getTemplates() {
    return Array.from(document.querySelectorAll("template.blog-post"));
  }

  async function waitForTemplates(timeoutMs = 6000) {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const tpls = getTemplates();
      if (tpls.length) return tpls;
      await sleep(120);
    }
    console.warn("[BLOG] templates NOT found. Home must include templateblog.html (even hidden).");
    return [];
  }

  function observeTemplateChanges() {
    const container = document.getElementById("templateblog-container") || document.body;
    const mo = new MutationObserver(() => {
      const tpls = getTemplates();
      if (tpls.length && tpls.length !== templates.length) {
        templates = tpls;
        console.log("[BLOG] templates updated:", templates.map(t=>t.id));
        if (grid) renderCards();
        renderHeroNewsTicker(HERO_NEWS_IDS);
        autoOpenFromUrl();
      }
    });
    mo.observe(container, { childList: true, subtree: true });
  }

  // ======================
  // BLOG GRID  (PUBLICATION STYLE)
  // ======================
  function renderCards() {
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
          <p class="blog-card__meta" title="${escAttr(meta)}">${escHtml(meta)}</p>
          <p class="blog-card__excerpt">${escHtml(excerpt)}</p>
          <span class="blog-card__cta">Read more →</span>
        </div>
      `;

      card.addEventListener("click", () => openById(postId, { fromCard: card }));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openById(postId, { fromCard: card });
        }
      });

      grid.appendChild(card);
    });
  }

  // ======================
  // OPEN BY ID (card + ticker)
  // ======================
  async function openById(postId, opts = {}) {
    const tpl = document.getElementById(postId);
    if (!tpl || tpl.tagName !== "TEMPLATE") {
      console.warn("[OPEN] template not found:", postId);
      return;
    }

    if (!modal || !panel || !titleEl || !metaEl || !excerptEl || !bodyEl || !coverEl) {
      console.warn("[OPEN] modal not found on this page => please include blogModal HTML on Home too.");
      return;
    }

    lastActive = document.activeElement;

    if (opts.fromCard) {
      const img = opts.fromCard.querySelector(".blog-card__thumbimg");
      if (img) {
        lastThumbRect = img.getBoundingClientRect();
        lastThumbSrc = img.currentSrc || img.src;
        return openFromTemplate(tpl, { animate: true, thumbRect: lastThumbRect, thumbSrc: lastThumbSrc, postId });
      }
    }

    return openFromTemplate(tpl, { animate: false, postId });
  }

  // ======================
  // AUTO OPEN FROM URL
  // - hỗ trợ ?post=post-01 hoặc #post-01
  // ======================
  function getPostIdFromUrl() {
    const sp = new URLSearchParams(location.search);
    const q = (sp.get("post") || "").trim();
    if (q) return decodeURIComponent(q);

    const h = (location.hash || "").replace("#", "").trim();
    if (h) return decodeURIComponent(h);

    return "";
  }

  function autoOpenFromUrl() {
    const postId = getPostIdFromUrl();
    if (!postId) return;

    if (document.body.dataset.openedUrl === postId) return;

    const tpl = document.getElementById(postId);
    if (!tpl) return;

    if (!modal) {
      console.warn("[URL] modal not found, cannot auto open:", postId);
      return;
    }

    console.log("[URL] auto open:", postId);
    document.body.dataset.openedUrl = postId;
    openById(postId);
  }

  // ======================
  // OPEN MODAL FROM TEMPLATE
  // ======================
  async function openFromTemplate(tpl, opts = {}) {
    if (isAnimating) return;
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

    modal.dataset.activePostId = postId;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("blog-modal-lock");

    hardResetPanelHidden();

    await nextFrame();
    await nextFrame();

    if (animate && thumbRect && coverEl) {
      isAnimating = true;
      const ghost = createGhost(thumbRect, thumbSrc || cover);
      const coverRect = coverEl.getBoundingClientRect();

      await animateGhost(ghost, thumbRect, coverRect, {
        fromRadius: 14,
        toRadius: 14,
        duration: 720
      });

      panel.style.opacity = "1";
      ghost.remove();
      isAnimating = false;
    } else {
      panel.style.opacity = "1";
    }

    const closeBtn = modal.querySelector(".blog-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  // ======================
  // HERO TICKER
  // ======================
  function renderHeroNewsTicker(ids) {
    if (!heroWrap || !heroMarquee || !heroList) {
      console.warn("[HERO] hero elements missing on this page.");
      return;
    }

    const found = [];
    const missing = [];

    ids.forEach((id) => {
      const tpl = document.getElementById(id);
      if (tpl && tpl.tagName === "TEMPLATE") found.push(tpl);
      else missing.push(id);
    });

    console.group("[HERO] resolve");
    console.log("found:", found.map(t => t.id));
    console.log("missing:", missing);
    console.groupEnd();

    heroWrap.hidden = false;

    if (!found.length) {
      heroMarquee.innerHTML = `<div class="hero-news__row">
        <span class="hero-news__item">No announcements. Home must include templateblog.html</span>
      </div>`;
      heroList.innerHTML = "";
      return;
    }

    const itemsHtml = found.map((tpl, idx) => {
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
    }).join("");

    heroMarquee.innerHTML =
      `<div class="hero-news__row">${itemsHtml}</div>` +
      `<div class="hero-news__row">${itemsHtml}</div>`;

    heroList.innerHTML = found.map((tpl) => {
      const title = tpl.dataset.title || "Untitled";
      const meta = tpl.dataset.meta || "";
      return `
        <span class="hero-news__item" role="link" tabindex="0" data-post-id="${escAttr(tpl.id)}">
          <strong>${escHtml(title)}</strong>
          <span class="hero-news__meta">${meta ? "• " + escHtml(meta) : ""}</span>
        </span>
      `;
    }).join("");

    if (!heroWrap.dataset.bound) {
      heroWrap.dataset.bound = "1";

      heroWrap.addEventListener("click", (e) => {
        const item = e.target.closest(".hero-news__item");
        if (!item) return;
        openById(item.dataset.postId);
      });

      heroWrap.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const item = e.target.closest(".hero-news__item");
        if (!item) return;
        e.preventDefault();
        openById(item.dataset.postId);
      });
    }
  }

  // ======================
  // CLOSE MODAL
  // ======================
  function requestClose() {
    if (isAnimating) return;
    if (!modal || !modal.classList.contains("is-open")) return;
    closeModal();
  }

  async function closeModal() {
    if (!lastThumbRect) return finalizeClose();

    isAnimating = true;

    const coverRect = coverEl.getBoundingClientRect();
    const ghost = createGhost(coverRect, coverEl.currentSrc || coverEl.src || lastThumbSrc);

    panel.style.opacity = "0";

    await animateGhost(ghost, coverRect, lastThumbRect, {
      fromRadius: 14,
      toRadius: 14,
      duration: 520
    });

    ghost.remove();
    isAnimating = false;
    finalizeClose();
  }

  function finalizeClose() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("blog-modal-lock");
    bodyEl.innerHTML = "";
    hardResetPanelHidden();
    if (lastActive && typeof lastActive.focus === "function") lastActive.focus();
  }

  function hardResetPanelHidden() {
    panel.style.transition = "none";
    panel.style.transform = "translate(-50%, -50%)";
    panel.style.borderRadius = "18px";
    panel.style.opacity = "0";
    panel.getBoundingClientRect();
    panel.style.transition = "";
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
        { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, borderRadius: `${toRadius}px`, opacity: 1 }
      ],
      { duration, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
    );

    return new Promise((resolve) => {
      anim.onfinish = () => resolve();
      anim.oncancel = () => resolve();
    });
  }

  function nextFrame() {
    return new Promise((r) => requestAnimationFrame(() => r()));
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      const closeTarget = e.target.closest('[data-close="true"]');
      if (closeTarget) requestClose();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("is-open")) requestClose();
  });

  // ======================
  // SHARE FACEBOOK (CHỐT LỖI ẢNH BẠN GỬI)
  // - Share: https://amadas.vercel.app/api/share/<postId>
  // - Người bấm từ FB: API sẽ redirect về blog + ?post=... và autoOpenFromUrl() sẽ mở popup
  // ======================

  function getTplByPostId(postId) {
    const tpl = document.getElementById(postId);
    if (!tpl || tpl.tagName !== "TEMPLATE") return null;
    return tpl;
  }

  function buildShareUrl(postId) {
    // Nếu bạn có domain khác, chỉ cần đổi ORIGIN (hoặc dùng location.origin)
    const ORIGIN = "https://amadas.vercel.app";
    return ORIGIN + "/api/share/" + encodeURIComponent(postId);
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

  // ✅ HÀM NÀY PHẢI NHẬN postId (không nhận shareUrl)
  function openFacebookComposer(postId) {
    const shareUrl = buildShareUrl(postId);
    const quote = buildQuote(postId);

    // u= phải là URL đầy đủ (fix lỗi "href should represent a valid URL")
    const fb =
      "https://www.facebook.com/sharer/sharer.php?u=" +
      encodeURIComponent(shareUrl) +
      "&quote=" + encodeURIComponent(quote);

    window.open(fb, "fbshare", "width=980,height=720,noopener,noreferrer");
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".share-facebook");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const postId =
      (btn.dataset && btn.dataset.postid) ||
      (modal && modal.dataset && modal.dataset.activePostId) ||
      "";

    if (!postId) {
      console.warn("[SHARE] missing postId");
      return;
    }

    // ✅ FIX: gọi đúng với postId
    openFacebookComposer(postId);
  });

  // ======================
  // ESCAPE HELPERS
  // ======================
  function escHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escAttr(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
});

// document.addEventListener("DOMContentLoaded", async () => {
//   await waitForIncludes();

//   // ===== DOM =====
//   const grid  = document.getElementById("blogGrid");     // chỉ có ở trang blog grid
//   const modal = document.getElementById("blogModal");    // popup modal
//   const panel = document.getElementById("modalPanel");

//   const coverEl   = document.getElementById("modalCover");
//   const titleEl   = document.getElementById("modalTitle");
//   const metaEl    = document.getElementById("modalMeta");
//   const excerptEl = document.getElementById("modalExcerpt");
//   const bodyEl    = document.getElementById("modalBody");

//   // hero ticker
//   const heroWrap    = document.getElementById("heroNews");
//   const heroMarquee = document.getElementById("heroNewsMarquee");
//   const heroList    = document.getElementById("heroNewsList");

//   // state
//   let templates = [];
//   let lastActive = null;
//   let lastThumbRect = null;
//   let lastThumbSrc = "";
//   let isAnimating = false;

//   const HERO_NEWS_IDS = ["post-01", "post-02"];

//   console.group("[BLOG] init");
//   console.log("path:", location.pathname);
//   console.log("grid:", !!grid, "modal:", !!modal, "panel:", !!panel);
//   console.log("heroWrap:", !!heroWrap, "heroMarquee:", !!heroMarquee, "heroList:", !!heroList);
//   console.log("HERO_NEWS_IDS:", HERO_NEWS_IDS);
//   console.groupEnd();

//   // 1) đợi templates (quan trọng: Home phải include templateblog.html)
//   templates = await waitForTemplates(12000);

//   console.group("[BLOG] templates");
//   console.log("count:", templates.length);
//   console.log("ids:", templates.map(t => t.id));
//   console.groupEnd();

//   // 2) render blog cards nếu có grid
//   if (grid && templates.length) renderCards();

//   // 3) render ticker
//   renderHeroNewsTicker(HERO_NEWS_IDS);

//   // 4) auto open theo URL (?post=... hoặc #post-...)
//   autoOpenFromUrl();

//   // 5) observe changes
//   observeTemplateChanges();

//   // ======================
//   // INCLUDE WAIT
//   // ======================
//   async function waitForIncludes(timeoutMs = 8000) {
//     const start = performance.now();

//     if (typeof includePartials === "function") {
//       try { await includePartials(); }
//       catch (e) { console.warn("[INCLUDE] includePartials error:", e); }
//     } else {
//       console.warn("[INCLUDE] includePartials() not found. Ensure app.js loaded before blog-modal.js");
//     }

//     while (performance.now() - start < timeoutMs) {
//       const tplCount = document.querySelectorAll("template.blog-post").length;
//       const heroOk = !!document.getElementById("heroNews");
//       if (heroOk || tplCount > 0) return true;
//       await sleep(80);
//     }
//     console.warn("[INCLUDE] timeout. continue anyway.");
//     return false;
//   }

//   // ======================
//   // TEMPLATES
//   // ======================
//   function getTemplates() {
//     return Array.from(document.querySelectorAll("template.blog-post"));
//   }

//   async function waitForTemplates(timeoutMs = 6000) {
//     const start = performance.now();
//     while (performance.now() - start < timeoutMs) {
//       const tpls = getTemplates();
//       if (tpls.length) return tpls;
//       await sleep(120);
//     }
//     console.warn("[BLOG] templates NOT found. Home must include templateblog.html (even hidden).");
//     return [];
//   }

//   function observeTemplateChanges() {
//     const container = document.getElementById("templateblog-container") || document.body;
//     const mo = new MutationObserver(() => {
//       const tpls = getTemplates();
//       if (tpls.length && tpls.length !== templates.length) {
//         templates = tpls;
//         console.log("[BLOG] templates updated:", templates.map(t=>t.id));
//         if (grid) renderCards();
//         renderHeroNewsTicker(HERO_NEWS_IDS);
//         autoOpenFromUrl();
//       }
//     });
//     mo.observe(container, { childList: true, subtree: true });
//   }

//   // ======================
//   // BLOG GRID  (PUBLICATION STYLE)
//   // ======================
//   function renderCards() {
//     grid.innerHTML = "";

//     templates.forEach((tpl) => {
//       const title = tpl.dataset.title || "Untitled";
//       const meta = tpl.dataset.meta || "";
//       const cover = tpl.dataset.cover || "";
//       const excerpt = tpl.dataset.excerpt || "";
//       const postId = tpl.id;

//       const card = document.createElement("article");
//       card.className = "blog-card blog-card--pub";
//       card.tabIndex = 0;
//       card.dataset.postId = postId;

//       // ✅ publication-like row: thumb-left + content-right
//       card.innerHTML = `
//         <div class="blog-card__left">
//           <img class="blog-card__thumbimg"
//                src="${escAttr(cover)}"
//                alt="${escAttr(title)}"
//                loading="lazy" />
//         </div>

//         <div class="blog-card__right">
//           <h3 class="blog-card__title" title="${escAttr(title)}">${escHtml(title)}</h3>
//           <p class="blog-card__meta" title="${escAttr(meta)}">${escHtml(meta)}</p>
//           <p class="blog-card__excerpt">${escHtml(excerpt)}</p>
//           <span class="blog-card__cta">Read more →</span>
//         </div>
//       `;

//       // mở modal khi click card
//       card.addEventListener("click", () => openById(postId, { fromCard: card }));
//       card.addEventListener("keydown", (e) => {
//         if (e.key === "Enter" || e.key === " ") {
//           e.preventDefault();
//           openById(postId, { fromCard: card });
//         }
//       });

//       grid.appendChild(card);
//     });
//   }

//   // ======================
//   // OPEN BY ID (card + ticker)
//   // ======================
//   async function openById(postId, opts = {}) {
//     const tpl = document.getElementById(postId);
//     if (!tpl || tpl.tagName !== "TEMPLATE") {
//       console.warn("[OPEN] template not found:", postId);
//       return;
//     }

//     // ✅ bạn làm popup, nên bắt buộc phải có modal DOM
//     if (!modal || !panel || !titleEl || !metaEl || !excerptEl || !bodyEl || !coverEl) {
//       console.warn("[OPEN] modal not found on this page => please include blogModal HTML on Home too.");
//       return;
//     }

//     lastActive = document.activeElement;

//     // animate nếu mở từ card
//     if (opts.fromCard) {
//       const img = opts.fromCard.querySelector(".blog-card__thumbimg");
//       if (img) {
//         lastThumbRect = img.getBoundingClientRect();
//         lastThumbSrc = img.currentSrc || img.src;
//         return openFromTemplate(tpl, { animate: true, thumbRect: lastThumbRect, thumbSrc: lastThumbSrc, postId });
//       }
//     }

//     // ticker mở ngay
//     return openFromTemplate(tpl, { animate: false, postId });
//   }

//   // ======================
//   // AUTO OPEN FROM URL
//   // - hỗ trợ ?post=post-01 hoặc #post-01
//   // ======================
//   function getPostIdFromUrl() {
//     const sp = new URLSearchParams(location.search);
//     const q = (sp.get("post") || "").trim();
//     if (q) return decodeURIComponent(q);

//     const h = (location.hash || "").replace("#", "").trim();
//     if (h) return decodeURIComponent(h);

//     return "";
//   }

//   function autoOpenFromUrl() {
//     const postId = getPostIdFromUrl();
//     if (!postId) return;

//     if (document.body.dataset.openedUrl === postId) return;

//     const tpl = document.getElementById(postId);
//     if (!tpl) return;

//     if (!modal) {
//       console.warn("[URL] modal not found, cannot auto open:", postId);
//       return;
//     }

//     console.log("[URL] auto open:", postId);
//     document.body.dataset.openedUrl = postId;
//     openById(postId);
//   }

//   // ======================
//   // OPEN MODAL FROM TEMPLATE
//   // ======================
//   async function openFromTemplate(tpl, opts = {}) {
//     if (isAnimating) return;
//     if (modal.classList.contains("is-open")) return;

//     const { animate = false, thumbRect = null, thumbSrc = "", postId = tpl.id } = opts;

//     const title = tpl.dataset.title || "Untitled";
//     const meta = tpl.dataset.meta || "";
//     const cover = tpl.dataset.cover || thumbSrc || "";
//     const excerpt = tpl.dataset.excerpt || "";

//     titleEl.textContent = title;
//     metaEl.textContent = meta;
//     excerptEl.textContent = excerpt;

//     coverEl.src = cover;
//     coverEl.alt = title;
//     coverEl.style.display = cover ? "" : "none";

//     bodyEl.innerHTML = "";
//     bodyEl.appendChild(tpl.content.cloneNode(true));

//     // lưu postId hiện tại để share
//     modal.dataset.activePostId = postId;

//     modal.classList.add("is-open");
//     modal.setAttribute("aria-hidden", "false");
//     document.body.classList.add("blog-modal-lock");

//     hardResetPanelHidden();

//     await nextFrame();
//     await nextFrame();

//     if (animate && thumbRect && coverEl) {
//       isAnimating = true;
//       const ghost = createGhost(thumbRect, thumbSrc || cover);
//       const coverRect = coverEl.getBoundingClientRect();

//       await animateGhost(ghost, thumbRect, coverRect, {
//         fromRadius: 14,
//         toRadius: 14,
//         duration: 720
//       });

//       panel.style.opacity = "1";
//       ghost.remove();
//       isAnimating = false;
//     } else {
//       panel.style.opacity = "1";
//     }

//     const closeBtn = modal.querySelector(".blog-modal__close");
//     if (closeBtn) closeBtn.focus();
//   }

//   // ======================
//   // HERO TICKER
//   // ======================
//   function renderHeroNewsTicker(ids) {
//     if (!heroWrap || !heroMarquee || !heroList) {
//       console.warn("[HERO] hero elements missing on this page.");
//       return;
//     }

//     const found = [];
//     const missing = [];

//     ids.forEach((id) => {
//       const tpl = document.getElementById(id);
//       if (tpl && tpl.tagName === "TEMPLATE") found.push(tpl);
//       else missing.push(id);
//     });

//     console.group("[HERO] resolve");
//     console.log("found:", found.map(t => t.id));
//     console.log("missing:", missing);
//     console.groupEnd();

//     heroWrap.hidden = false;

//     if (!found.length) {
//       heroMarquee.innerHTML = `<div class="hero-news__row">
//         <span class="hero-news__item">No announcements. Home must include templateblog.html</span>
//       </div>`;
//       heroList.innerHTML = "";
//       return;
//     }

//     const itemsHtml = found.map((tpl, idx) => {
//       const title = tpl.dataset.title || "Untitled";
//       const meta = tpl.dataset.meta || "";
//       const dot = idx === 0 ? "" : `<span class="hero-news__dot" aria-hidden="true"></span>`;
//       return `
//         ${dot}
//         <span class="hero-news__item" role="link" tabindex="0" data-post-id="${escAttr(tpl.id)}">
//           <strong>${escHtml(title)}</strong>
//           <span class="hero-news__meta">${meta ? "• " + escHtml(meta) : ""}</span>
//         </span>
//       `;
//     }).join("");

//     heroMarquee.innerHTML =
//       `<div class="hero-news__row">${itemsHtml}</div>` +
//       `<div class="hero-news__row">${itemsHtml}</div>`;

//     heroList.innerHTML = found.map((tpl) => {
//       const title = tpl.dataset.title || "Untitled";
//       const meta = tpl.dataset.meta || "";
//       return `
//         <span class="hero-news__item" role="link" tabindex="0" data-post-id="${escAttr(tpl.id)}">
//           <strong>${escHtml(title)}</strong>
//           <span class="hero-news__meta">${meta ? "• " + escHtml(meta) : ""}</span>
//         </span>
//       `;
//     }).join("");

//     if (!heroWrap.dataset.bound) {
//       heroWrap.dataset.bound = "1";

//       heroWrap.addEventListener("click", (e) => {
//         const item = e.target.closest(".hero-news__item");
//         if (!item) return;
//         openById(item.dataset.postId);
//       });

//       heroWrap.addEventListener("keydown", (e) => {
//         if (e.key !== "Enter" && e.key !== " ") return;
//         const item = e.target.closest(".hero-news__item");
//         if (!item) return;
//         e.preventDefault();
//         openById(item.dataset.postId);
//       });
//     }
//   }

//   // ======================
//   // CLOSE MODAL
//   // ======================
//   function requestClose() {
//     if (isAnimating) return;
//     if (!modal || !modal.classList.contains("is-open")) return;
//     closeModal();
//   }

//   async function closeModal() {
//     if (!lastThumbRect) return finalizeClose();

//     isAnimating = true;

//     const coverRect = coverEl.getBoundingClientRect();
//     const ghost = createGhost(coverRect, coverEl.currentSrc || coverEl.src || lastThumbSrc);

//     panel.style.opacity = "0";

//     await animateGhost(ghost, coverRect, lastThumbRect, {
//       fromRadius: 14,
//       toRadius: 14,
//       duration: 520
//     });

//     ghost.remove();
//     isAnimating = false;
//     finalizeClose();
//   }

//   function finalizeClose() {
//     modal.classList.remove("is-open");
//     modal.setAttribute("aria-hidden", "true");
//     document.body.classList.remove("blog-modal-lock");
//     bodyEl.innerHTML = "";
//     hardResetPanelHidden();
//     if (lastActive && typeof lastActive.focus === "function") lastActive.focus();
//   }

//   function hardResetPanelHidden() {
//     panel.style.transition = "none";
//     panel.style.transform = "translate(-50%, -50%)";
//     panel.style.borderRadius = "18px";
//     panel.style.opacity = "0";
//     panel.getBoundingClientRect();
//     panel.style.transition = "";
//   }

//   function createGhost(rect, src) {
//     const img = document.createElement("img");
//     img.className = "blog-ghost";
//     img.src = src;
//     img.style.left = `${rect.left}px`;
//     img.style.top = `${rect.top}px`;
//     img.style.width = `${rect.width}px`;
//     img.style.height = `${rect.height}px`;
//     document.body.appendChild(img);
//     return img;
//   }

//   function animateGhost(el, fromRect, toRect, opts) {
//     const { duration, fromRadius, toRadius } = opts;
//     const dx = toRect.left - fromRect.left;
//     const dy = toRect.top - fromRect.top;
//     const sx = toRect.width / fromRect.width;
//     const sy = toRect.height / fromRect.height;

//     const anim = el.animate(
//       [
//         { transform: "translate(0px,0px) scale(1,1)", borderRadius: `${fromRadius}px`, opacity: 1 },
//         { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, borderRadius: `${toRadius}px`, opacity: 1 }
//       ],
//       { duration, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
//     );

//     return new Promise((resolve) => {
//       anim.onfinish = () => resolve();
//       anim.oncancel = () => resolve();
//     });
//   }

//   function nextFrame() {
//     return new Promise((r) => requestAnimationFrame(() => r()));
//   }

//   function sleep(ms) {
//     return new Promise((r) => setTimeout(r, ms));
//   }

//   if (modal) {
//     modal.addEventListener("click", (e) => {
//       const closeTarget = e.target.closest('[data-close="true"]');
//       if (closeTarget) requestClose();
//     });
//   }

//   document.addEventListener("keydown", (e) => {
//     if (e.key === "Escape" && modal && modal.classList.contains("is-open")) requestClose();
//   });

//     // ======================
//   // SHARE FACEBOOK (MỞ ĐÚNG POPUP “TẠO BÀI VIẾT”)
//   // - Không tạo file, không server
//   // - Tự điền caption (quote) để không bị "chỉ có Blog"
//   // ======================

//   function getTplByPostId(postId) {
//     const tpl = document.getElementById(postId);
//     if (!tpl || tpl.tagName !== "TEMPLATE") return null;
//     return tpl;
//   }

//   function buildShareUrl(postId) {
//     // Canonical URL để share: dùng query param
//     const url = new URL(window.location.href);
//     url.searchParams.set("post", postId);
//     url.hash = ""; // bỏ hash

//     // (tuỳ chọn) cache-bust nhẹ giúp FB đôi khi chịu cập nhật preview
//     // BẬT nếu bạn đang bị FB "dính cache" preview cũ
//     // url.searchParams.set("v", String(Date.now()));

//     return url.toString();
//   }

//   function buildQuote(postId) {
//     const tpl = getTplByPostId(postId);

//     const title = tpl?.dataset?.title?.trim() || "Blog";
//     const excerpt = tpl?.dataset?.excerpt?.trim() || "";
//     const meta = tpl?.dataset?.meta?.trim() || "";

//     // Quote ngắn gọn, đẹp, tránh quá dài
//     const lines = [];
//     lines.push(title);
//     if (meta) lines.push(meta);
//     if (excerpt) lines.push("", excerpt);

//     // Giới hạn để không quá dài (Facebook đôi khi cắt)
//     const quote = lines.join("\n").trim();
//     return quote.length > 600 ? quote.slice(0, 600) + "…" : quote;
//   }

//   function openFacebookComposer(postId) {
//     const shareUrl = buildShareUrl(postId);
//     const quote = buildQuote(postId);

//     // Dùng sharer chuẩn + quote
//     const fb =
//       "https://www.facebook.com/sharer/sharer.php?u=" +
//       encodeURIComponent(shareUrl) +
//       "&quote=" + encodeURIComponent(quote);

//     window.open(fb, "fbshare", "width=980,height=720,noopener,noreferrer");
//   }

//   // Event delegation: bắt click mọi nút .share-facebook
//   document.addEventListener("click", (e) => {
//     const btn = e.target.closest(".share-facebook");
//     if (!btn) return;

//     e.preventDefault();
//     e.stopPropagation();

//     // Ưu tiên postId trên nút, fallback postId đang mở trong modal
//     const postId =
//       (btn.dataset && btn.dataset.postid) ||
//       (modal && modal.dataset && modal.dataset.activePostId) ||
//       "";

//     if (!postId) {
//       console.warn("[SHARE] missing postId");
//       return;
//     }

//     openFacebookComposer(postId);
//   });

//   // ======================
//   // ESCAPE HELPERS
//   // ======================
//   function escHtml(s) {
//     return String(s)
//       .replaceAll("&", "&amp;")
//       .replaceAll("<", "&lt;")
//       .replaceAll(">", "&gt;");
//   }

//   function escAttr(s) {
//     return String(s)
//       .replaceAll("&", "&amp;")
//       .replaceAll('"', "&quot;")
//       .replaceAll("<", "&lt;")
//       .replaceAll(">", "&gt;");
//   }
// });
