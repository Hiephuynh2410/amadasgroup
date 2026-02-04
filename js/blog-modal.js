document.addEventListener("DOMContentLoaded", async () => {
  // Có thể có hoặc không tùy trang
  const grid  = document.getElementById("blogGrid");
  const modal = document.getElementById("blogModal");
  const panel = document.getElementById("modalPanel");

  // Các element trong modal (có thể null nếu trang Home không có modal)
  const coverEl   = document.getElementById("modalCover");
  const titleEl   = document.getElementById("modalTitle");
  const metaEl    = document.getElementById("modalMeta");
  const excerptEl = document.getElementById("modalExcerpt");
  const bodyEl    = document.getElementById("modalBody");

  let templates = [];
  let lastActive = null;
  let lastThumbRect = null;
  let lastThumbSrc = "";
  let isAnimating = false;

  // 1) Đợi template xuất hiện (vì include async)
  templates = await waitForTemplates(6000);

  // 2) Render cards nếu có blogGrid (trang Blog)
  if (grid && templates.length) {
    renderCards();
  }

  // =========================
  // HERO NEWS TICKER (config by IDs)
  // Sau này chỉ cần sửa mảng ID này
  // =========================
  const HERO_NEWS_IDS = ["post-01", "post-02"];
  renderHeroNewsTicker(HERO_NEWS_IDS);

  // 3) Nếu sau này bạn load thêm template (SPA/partials) thì refresh
  observeTemplateChanges();

  // =========================
  // TEMPLATES
  // =========================
  function getTemplates() {
    return Array.from(document.querySelectorAll("template.blog-post"));
  }

  async function waitForTemplates(timeoutMs = 4000) {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const tpls = getTemplates();
      if (tpls.length) return tpls;
      await sleep(60);
    }
    return [];
  }

  function observeTemplateChanges() {
    const container = document.getElementById("templateblog-container") || document.body;
    const mo = new MutationObserver(() => {
      const tpls = getTemplates();
      if (tpls.length && tpls.length !== templates.length) {
        templates = tpls;

        if (grid) renderCards();              // Blog page
        renderHeroNewsTicker(HERO_NEWS_IDS);  // Home page ticker refresh
      }
    });
    mo.observe(container, { childList: true, subtree: true });
  }

  // =========================
  // BLOG GRID (cards)
  // =========================
  function renderCards() {
    grid.innerHTML = "";

    templates.forEach((tpl) => {
      const title = tpl.dataset.title || "Untitled";
      const meta = tpl.dataset.meta || "";
      const cover = tpl.dataset.cover || "";
      const excerpt = tpl.dataset.excerpt || "";
      const postId = tpl.id;

      const card = document.createElement("article");
      card.className = "blog-card";
      card.tabIndex = 0;
      card.dataset.postId = postId;

      card.innerHTML = `
        <div class="blog-card__thumb">
          <img src="${cover}" alt="${escHtml(title)}" loading="lazy" />
        </div>
        <div class="blog-card__body">
          <h3 class="blog-card__title" data-full="${escAttr(title)}">${escHtml(title)}</h3>
          <p class="blog-card__meta" data-full="${escAttr(meta)}">${escHtml(meta)}</p>
          <p class="blog-card__excerpt">${escHtml(excerpt)}</p>
          <span class="blog-card__cta">Read more →</span>
        </div>
      `;

      card.addEventListener("click", () => openFromCard(card));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFromCard(card);
        }
      });

      grid.appendChild(card);
    });
  }

  async function openFromCard(card) {
    if (isAnimating) return;
    if (!modal || !panel) return; // nếu trang không có modal thì thôi
    if (modal.classList.contains("is-open")) return;

    const postId = card.dataset.postId;
    const tpl = document.getElementById(postId);
    if (!tpl) return;

    lastActive = document.activeElement;

    const thumbImg = card.querySelector(".blog-card__thumb img");
    if (!thumbImg) return;

    lastThumbRect = thumbImg.getBoundingClientRect();
    lastThumbSrc = thumbImg.currentSrc || thumbImg.src;

    openFromTemplate(tpl, { animate: true, thumbRect: lastThumbRect, thumbSrc: lastThumbSrc });
  }

  // =========================
  // OPEN MODAL FROM TEMPLATE
  // - dùng chung cho card + ticker
  // =========================
  async function openFromTemplate(tpl, opts = {}) {
    if (!modal || !panel || !titleEl || !metaEl || !excerptEl || !bodyEl || !coverEl) return;

    const { animate = false, thumbRect = null, thumbSrc = "" } = opts;

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

  // =========================
  // HERO NEWS TICKER
  // =========================
  function renderHeroNewsTicker(ids) {
    const wrap = document.getElementById("heroNews");
    const marquee = document.getElementById("heroNewsMarquee");
    const list = document.getElementById("heroNewsList");
    if (!wrap || !marquee || !list) return;

    const picked = ids
      .map((id) => document.getElementById(id))
      .filter((tpl) => tpl && tpl.tagName === "TEMPLATE");

    if (!picked.length) {
      wrap.style.display = "none";
      return;
    }
    wrap.style.display = "";

    const itemsHtml = picked.map((tpl, idx) => {
      const title = tpl.dataset.title || "Untitled";
      const meta = tpl.dataset.meta || "";
      const dot = idx === 0 ? "" : `<span class="hero-news__dot" aria-hidden="true"></span>`;
      return `
        ${dot}
        <span class="hero-news__item" role="link" tabindex="0" data-post-id="${tpl.id}">
          <strong>${escHtml(title)}</strong>
          <span class="hero-news__meta">${meta ? "• " + escHtml(meta) : ""}</span>
        </span>
      `;
    }).join("");

    // nhân đôi để chạy mượt
    marquee.innerHTML =
      `<div class="hero-news__row">${itemsHtml}</div>` +
      `<div class="hero-news__row">${itemsHtml}</div>`;

    // fallback list
    list.innerHTML = picked.map((tpl) => {
      const title = tpl.dataset.title || "Untitled";
      const meta = tpl.dataset.meta || "";
      return `
        <span class="hero-news__item" role="link" tabindex="0" data-post-id="${tpl.id}">
          <strong>${escHtml(title)}</strong>
          <span class="hero-news__meta">${meta ? "• " + escHtml(meta) : ""}</span>
        </span>
      `;
    }).join("");

    // tránh bind lặp
    if (!wrap.dataset.bound) {
      wrap.dataset.bound = "1";

      wrap.addEventListener("click", (e) => {
        const item = e.target.closest(".hero-news__item");
        if (!item) return;

        const tpl = document.getElementById(item.dataset.postId);
        if (!tpl) return;

        lastActive = document.activeElement;
        openFromTemplate(tpl, { animate: false });
      });

      wrap.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;

        const item = e.target.closest(".hero-news__item");
        if (!item) return;

        e.preventDefault();

        const tpl = document.getElementById(item.dataset.postId);
        if (!tpl) return;

        lastActive = document.activeElement;
        openFromTemplate(tpl, { animate: false });
      });
    }
  }

  // =========================
  // CLOSE MODAL (giữ nguyên logic của bạn)
  // =========================
  function requestClose() {
    if (isAnimating) return;
    if (!modal || !modal.classList.contains("is-open")) return;
    closeModal();
  }

  async function closeModal() {
    if (!modal || !panel || !coverEl || !bodyEl) return;
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
    if (!modal || !panel || !bodyEl) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("blog-modal-lock");
    bodyEl.innerHTML = "";

    hardResetPanelHidden();

    if (lastActive && typeof lastActive.focus === "function") lastActive.focus();
  }

  function hardResetPanelHidden() {
    if (!panel) return;
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
        { transform: "translate(0px, 0px) scale(1, 1)", borderRadius: `${fromRadius}px`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: `${toRadius}px`, opacity: 1 }
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

  // close events (chỉ khi có modal)
  if (modal) {
    modal.addEventListener("click", (e) => {
      const closeTarget = e.target.closest('[data-close="true"]');
      if (closeTarget) requestClose();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("is-open")) requestClose();
  });

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
});
