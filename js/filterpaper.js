// /js/filterpaper.js
(() => {
  "use strict";

  // bật debug log
  const DEBUG = true;
  const log = (...args) => DEBUG && console.log("[filterpaper]", ...args);
  const warn = (...args) => DEBUG && console.warn("[filterpaper]", ...args);

  // chặn chạy lại nếu SPA bắn event nhiều lần
  if (window.__AMADAS_FILTERPAPER__) {
    log("Skip: already initialized");
    return;
  }
  window.__AMADAS_FILTERPAPER__ = true;

  const STATE = {
    collapsedYears: new Set(),
    openYearKey: "",          
    initedDefault: false,  
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function ensureStyleOnce() {
    if (document.getElementById("amadas-pub-year-style")) return;

    const st = document.createElement("style");
    st.id = "amadas-pub-year-style";
    st.textContent = `
      .pub-filter-top{display:flex; align-items:center; gap:10px; margin:6px 0 18px;}
      .pub-year-pill{
        display:inline-flex; align-items:center; gap:10px;
        padding:10px 14px;
        border-radius:16px;
        box-shadow: 0 14px 40px rgba(0,0,0,.28);
        border:1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.06);
        backdrop-filter: blur(6px);
      }
      .pub-year-pill .lbl{font-weight:600; opacity:.9}
      .pub-year-pill select{
        appearance:none; -webkit-appearance:none; -moz-appearance:none;
        border:0; outline:0;
        background: transparent;
        color: inherit;
        font-size: 1rem;
        padding-right: 26px;
        cursor: pointer;
      }
      .pub-year-pill .caret{
        margin-left:-18px;
        pointer-events:none;
        opacity:.8;
      }
      .pub-year-sections{display:flex; flex-direction:column; gap:18px;}
      .pub-year-section{display:flex; flex-direction:column; gap:12px;}
      .pub-year-header{
        display:flex; align-items:center; justify-content:space-between;
        padding:3px 22px;
        border-radius:22px;
        box-shadow: 0 14px 40px rgba(0,0,0,.28);
        border:1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.05);
        backdrop-filter: blur(6px);
      }
      .pub-year-header .y{font-size:22px; font-weight:800; letter-spacing:.5px;}
      .pub-year-header .c{font-size:15px; opacity:.85;}
      .pub-year-header button.toggle{
        all: unset;
        cursor: pointer;
        width: 100%;
        display:flex; align-items:center; justify-content:space-between;
      }
      .pub-year-list{margin:0; padding-left: 0; list-style: none;}
      .pub-year-list .pub-item{list-style: none;}
      .pub-collapsed .pub-year-list{display:none;}
    `;
    document.head.appendChild(st);
  }

  function normYear(y) {
    y = String(y || "").trim();
    return /^\d{4}$/.test(y) ? y : "";
  }

  function getYearsFromItems(items) {
    const years = Array.from(
      new Set(items.map(li => normYear(li.dataset.year)).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a));
    return years;
  }

  function getYearFromUrl(validYears) {
    try {
      const u = new URL(window.location.href);
      const y = u.searchParams.get("year");
      if (y && (y === "all" || validYears.includes(y))) return y;
    } catch {}
    return "all";
  }

  function setYearToUrl(year) {
    try {
      const u = new URL(window.location.href);
      if (!year || year === "all") u.searchParams.delete("year");
      else u.searchParams.set("year", year);
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    } catch {}
  }

  function getDefaultOpenYearKey(years) {
    const now = new Date().getFullYear();
    const nowKey = String(now);
    if (years.includes(nowKey)) return nowKey;
    return years[0] || nowKey;
  }

  function initDefaultCollapse(years, openYearKey) {
    // prune key cũ
    for (const k of Array.from(STATE.collapsedYears)) {
      if (!years.includes(k)) STATE.collapsedYears.delete(k);
    }

    if (STATE.initedDefault) return;

    STATE.collapsedYears.clear();
    for (const y of years) {
      if (y !== openYearKey) STATE.collapsedYears.add(y);
    }
    STATE.initedDefault = true;
  }

  function syncCollapsedUI(sectionsEl) {
    const secs = $$(".pub-year-section", sectionsEl);
    for (const sec of secs) {
      const y = sec.dataset.year;
      if (!y) continue;
      sec.classList.toggle("pub-collapsed", STATE.collapsedYears.has(y));
    }
  }

  function buildUI() {
    const list = document.getElementById("pubAllList");
    const host = document.getElementById("pubYearGroups");

    if (!list || !host) {
      warn("Missing elements:", {
        has_pubAllList: !!list,
        has_pubYearGroups: !!host
      });
      return false;
    }

    const srcItems = $$("li.pub-item[data-year]", list);

    if (srcItems.length === 0) {
      warn("No items found with selector: li.pub-item[data-year]. Check your HTML data-year.");
      return false;
    }

    ensureStyleOnce();

    const years = getYearsFromItems(srcItems);
    log("Found items:", srcItems.length, "Years:", years);

    if (years.length === 0) {
      warn("All data-year are invalid. Expect 4 digits, e.g. data-year='2026'");
      return false;
    }

    STATE.openYearKey = getDefaultOpenYearKey(years);
    initDefaultCollapse(years, STATE.openYearKey);
    log("Default openYearKey =", STATE.openYearKey, "| collapsedYears =", Array.from(STATE.collapsedYears));

    host.innerHTML = "";
    host.dataset.built = "1";

    const top = document.createElement("div");
    top.className = "pub-filter-top";

    const pill = document.createElement("div");
    pill.className = "pub-year-pill";
    pill.innerHTML = `
      <span class="lbl">Year:</span>
      <select id="pubYearSelect" aria-label="Publication year filter"></select>
      <span class="caret">▾</span>
    `;

    top.appendChild(pill);
    host.appendChild(top);

    const sel = pill.querySelector("#pubYearSelect");

    // options
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "All";
    sel.appendChild(optAll);

    for (const y of years) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    }
    const sections = document.createElement("div");
    sections.className = "pub-year-sections";
    host.appendChild(sections);
    const byYear = new Map();
    for (const it of srcItems) {
      const y = normYear(it.dataset.year);
      if (!y) continue;
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(it);
    }

    for (const y of years) {
      const items = byYear.get(y) || [];

      const sec = document.createElement("section");
      sec.className = "pub-year-section";
      sec.dataset.year = y;

      if (STATE.collapsedYears.has(y)) sec.classList.add("pub-collapsed");

      const header = document.createElement("div");
      header.className = "pub-year-header";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "toggle";
      toggle.innerHTML = `
        <span class="y">${y}</span>
        <span class="c">${items.length} item(s)</span>
      `;

      header.appendChild(toggle);
      sec.appendChild(header);

      const ol = document.createElement("ol");
      ol.className = "pub-list pub-year-list";

      for (const it of items) {
        ol.appendChild(it.cloneNode(true));
      }

      sec.appendChild(ol);
      sections.appendChild(sec);

      toggle.addEventListener("click", () => {
        sec.classList.toggle("pub-collapsed");
        const collapsed = sec.classList.contains("pub-collapsed");

        if (collapsed) STATE.collapsedYears.add(y);
        else STATE.collapsedYears.delete(y);

        log("Toggle year", y, "collapsed =", collapsed, "| collapsedYears =", Array.from(STATE.collapsedYears));
      });
    }

    list.style.display = "none";
    list.setAttribute("aria-hidden", "true");

    const initial = getYearFromUrl(years);
    sel.value = initial;
    log("Initial filter from URL:", initial);

    function applyFilter(year) {
      const y = year || "all";
      const secs = $$(".pub-year-section", sections);

      let shown = 0;

      if (y === "all") {
        for (const s of secs) {
          s.hidden = false;
          shown++;
        }

        syncCollapsedUI(sections);
      } else {
        for (const s of secs) {
          const match = (s.dataset.year === y);
          s.hidden = !match;
          if (match) {
            shown++;
            s.classList.remove("pub-collapsed");   // auto mở
            STATE.collapsedYears.delete(y);        // đảm bảo lưu trạng thái mở
          }
        }
      }

      setYearToUrl(y);

      log("Apply filter:", {
        selectedYear: y,
        totalSections: secs.length,
        shownSections: shown,
        openYearKey: STATE.openYearKey,
        collapsedYears: Array.from(STATE.collapsedYears)
      });
    }

    sel.addEventListener("change", () => {
      log("Select changed:", sel.value);
      applyFilter(sel.value);
    });

    applyFilter(initial);

    if (initial === "all") {
      syncCollapsedUI(sections);
    }

    return true;
  }

  function boot() {
    log("Boot. readyState =", document.readyState);
    const ok = buildUI();
    log("buildUI() =>", ok);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("amadas:spa:rendered", () => {
    log("Event: amadas:spa:rendered");
    // cho chạy lại nếu host bị thay DOM
    const host = document.getElementById("pubYearGroups");
    if (host) host.dataset.built = "0";
    boot();
  });

  const mo = new MutationObserver(() => {
    const host = document.getElementById("pubYearGroups");
    const list = document.getElementById("pubAllList");
    if (host && list && host.dataset.built !== "1") {
      log("MutationObserver: detected unbuilt host => boot()");
      boot();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
