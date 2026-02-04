// document.addEventListener("DOMContentLoaded", () => {
//   const grid = document.getElementById("blogGrid");
//   const modal = document.getElementById("blogModal");
//   const panel = document.getElementById("modalPanel");
//   if (!grid || !modal || !panel) return;

//   const coverEl = document.getElementById("modalCover");
//   const titleEl = document.getElementById("modalTitle");
//   const metaEl  = document.getElementById("modalMeta");
//   const excerptEl = document.getElementById("modalExcerpt");
//   const bodyEl = document.getElementById("modalBody");

//   const templates = Array.from(document.querySelectorAll("template.blog-post"));

//   let lastActive = null;
//   let lastThumbRect = null;
//   let lastThumbSrc = "";
//   let isAnimating = false;

//   renderCards();

//   function renderCards() {
//     grid.innerHTML = "";

//     templates.forEach((tpl) => {
//       const title = tpl.dataset.title || "Untitled";
//       const meta = tpl.dataset.meta || "";
//       const cover = tpl.dataset.cover || "";
//       const excerpt = tpl.dataset.excerpt || "";
//       const postId = tpl.id;

//       const card = document.createElement("article");
//       card.className = "blog-card";
//       card.tabIndex = 0;
//       card.dataset.postId = postId;

//       card.innerHTML = `
//         <div class="blog-card__thumb">
//           <img src="${cover}" alt="${escHtml(title)}" loading="lazy" />
//         </div>
//         <div class="blog-card__body">
//           <h3 class="blog-card__title" data-full="${escAttr(title)}">${escHtml(title)}</h3>
//           <p class="blog-card__meta" data-full="${escAttr(meta)}">${escHtml(meta)}</p>
//           <p class="blog-card__excerpt">${escHtml(excerpt)}</p>
//           <span class="blog-card__cta">Xem bài →</span>
//         </div>
//       `;

//       card.addEventListener("click", () => openFromCard(card));
//       card.addEventListener("keydown", (e) => {
//         if (e.key === "Enter" || e.key === " ") {
//           e.preventDefault();
//           openFromCard(card);
//         }
//       });

//       grid.appendChild(card);
//     });
//   }

//   async function openFromCard(card) {
//     if (isAnimating) return;
//     if (modal.classList.contains("is-open")) return;

//     const postId = card.dataset.postId;
//     const tpl = document.getElementById(postId);
//     if (!tpl) return;

//     lastActive = document.activeElement;

//     // Lấy rect của thumbnail (chứ không lấy rect cả card)
//     const thumbImg = card.querySelector(".blog-card__thumb img");
//     if (!thumbImg) return;

//     lastThumbRect = thumbImg.getBoundingClientRect();
//     lastThumbSrc = thumbImg.currentSrc || thumbImg.src;

//     // Fill modal data (nhưng panel vẫn ẩn)
//     const title = tpl.dataset.title || "Untitled";
//     const meta = tpl.dataset.meta || "";
//     const cover = tpl.dataset.cover || lastThumbSrc;
//     const excerpt = tpl.dataset.excerpt || "";

//     titleEl.textContent = title;
//     metaEl.textContent = meta;
//     excerptEl.textContent = excerpt;

//     coverEl.src = cover;
//     coverEl.alt = title;
//     coverEl.style.display = cover ? "" : "none";

//     bodyEl.innerHTML = "";
//     bodyEl.appendChild(tpl.content.cloneNode(true));

//     // Mở modal (backdrop fade), nhưng panel vẫn opacity 0
//     modal.classList.add("is-open");
//     modal.setAttribute("aria-hidden", "false");
//     document.body.classList.add("blog-modal-lock");

//     // Reset panel style sạch để KHÔNG flash
//     hardResetPanelHidden();

//     // Đợi layout xong để coverEl có rect đúng
//     await nextFrame();
//     await nextFrame();

//     // Animate ghost từ thumb -> cover
//     isAnimating = true;
//     const ghost = createGhost(lastThumbRect, lastThumbSrc);

//     const coverRect = coverEl.getBoundingClientRect();

//     await animateGhost(ghost, lastThumbRect, coverRect, {
//       fromRadius: 14,
//       toRadius: 14,
//       duration: 720
//     });

//     // Sau khi ghost tới nơi, hiện panel thật (không flash)
//     panel.style.opacity = "1";

//     // Xoá ghost
//     ghost.remove();
//     isAnimating = false;

//     const closeBtn = modal.querySelector(".blog-modal__close");
//     if (closeBtn) closeBtn.focus();
//   }

//   function requestClose() {
//     if (isAnimating) return;
//     if (!modal.classList.contains("is-open")) return;
//     closeModal();
//   }

//   async function closeModal() {
//     if (!lastThumbRect) return finalizeClose();

//     isAnimating = true;

//     // Tạo ghost từ cover -> thumb (để panel ẩn đi trước, không chớp)
//     const coverRect = coverEl.getBoundingClientRect();
//     const ghost = createGhost(coverRect, coverEl.currentSrc || coverEl.src || lastThumbSrc);

//     // Ẩn panel thật ngay lập tức (tránh flash)
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
//     // reset panel về trạng thái chuẩn + ẩn
//     panel.style.transition = "none";
//     panel.style.transform = "translate(-50%, -50%)";
//     panel.style.borderRadius = "18px";
//     panel.style.opacity = "0";
//     panel.getBoundingClientRect(); // force apply
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

//     // dùng transform để mượt
//     const anim = el.animate(
//       [
//         {
//           transform: "translate(0px, 0px) scale(1, 1)",
//           borderRadius: `${fromRadius}px`,
//           opacity: 1
//         },
//         {
//           transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
//           borderRadius: `${toRadius}px`,
//           opacity: 1
//         }
//       ],
//       {
//         duration,
//         easing: "cubic-bezier(0.16, 1, 0.3, 1)",
//         fill: "forwards"
//       }
//     );

//     return new Promise((resolve) => {
//       anim.onfinish = () => resolve();
//       anim.oncancel = () => resolve();
//     });
//   }

//   function nextFrame() {
//     return new Promise((r) => requestAnimationFrame(() => r()));
//   }

//   // Close triggers
//   modal.addEventListener("click", (e) => {
//     const closeTarget = e.target.closest('[data-close="true"]');
//     if (closeTarget) requestClose();
//   });

//   document.addEventListener("keydown", (e) => {
//     if (e.key === "Escape" && modal.classList.contains("is-open")) requestClose();
//   });

//   function escHtml(s) {
//     return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
//   }
//   function escAttr(s) {
//     return String(s)
//       .replaceAll("&", "&amp;")
//       .replaceAll('"', "&quot;")
//       .replaceAll("<", "&lt;")
//       .replaceAll(">", "&gt;");
//   }
// });


document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("blogGrid");
  const modal = document.getElementById("blogModal");
  const panel = document.getElementById("modalPanel");
  if (!grid || !modal || !panel) return;

  const coverEl = document.getElementById("modalCover");
  const titleEl = document.getElementById("modalTitle");
  const metaEl  = document.getElementById("modalMeta");
  const excerptEl = document.getElementById("modalExcerpt");
  const bodyEl = document.getElementById("modalBody");

  let templates = [];                 // ✅ sẽ được nạp sau
  let lastActive = null;
  let lastThumbRect = null;
  let lastThumbSrc = "";
  let isAnimating = false;

  // ✅ 1) Chờ template xuất hiện (vì include load async)
  templates = await waitForTemplates(6000);
  if (!templates.length) {
    // nếu vẫn rỗng, bạn mở DevTools->Network coi template.html có 404 không
    console.warn("No blog templates found. Check include path for template.html");
    return;
  }

  renderCards();

  // ✅ 2) Nếu sau này bạn load thêm template (SPA), auto cập nhật lại
  // (quan trọng nếu bạn chuyển trang/partial mà không reload)
  observeTemplateChanges();

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
      // nếu số lượng thay đổi thì render lại
      if (tpls.length && tpls.length !== templates.length) {
        templates = tpls;
        renderCards();
      }
    });
    mo.observe(container, { childList: true, subtree: true });
  }

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
    if (modal.classList.contains("is-open")) return;

    const postId = card.dataset.postId;
    const tpl = document.getElementById(postId);
    if (!tpl) return;

    lastActive = document.activeElement;

    const thumbImg = card.querySelector(".blog-card__thumb img");
    if (!thumbImg) return;

    lastThumbRect = thumbImg.getBoundingClientRect();
    lastThumbSrc = thumbImg.currentSrc || thumbImg.src;

    const title = tpl.dataset.title || "Untitled";
    const meta = tpl.dataset.meta || "";
    const cover = tpl.dataset.cover || lastThumbSrc;
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

    isAnimating = true;
    const ghost = createGhost(lastThumbRect, lastThumbSrc);

    const coverRect = coverEl.getBoundingClientRect();

    await animateGhost(ghost, lastThumbRect, coverRect, {
      fromRadius: 14,
      toRadius: 14,
      duration: 720
    });

    panel.style.opacity = "1";

    ghost.remove();
    isAnimating = false;

    const closeBtn = modal.querySelector(".blog-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  function requestClose() {
    if (isAnimating) return;
    if (!modal.classList.contains("is-open")) return;
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
        {
          transform: "translate(0px, 0px) scale(1, 1)",
          borderRadius: `${fromRadius}px`,
          opacity: 1
        },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          borderRadius: `${toRadius}px`,
          opacity: 1
        }
      ],
      {
        duration,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "forwards"
      }
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

  modal.addEventListener("click", (e) => {
    const closeTarget = e.target.closest('[data-close="true"]');
    if (closeTarget) requestClose();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) requestClose();
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
