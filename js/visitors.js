// js/visitors.js
(function () {
  const TOTAL_ID = "total-visits";
  const ONLINE_ID = "online-now";

  const KEY = "amadas_sid";
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = (crypto?.randomUUID?.() || ("sid_" + Math.random().toString(16).slice(2)));
    localStorage.setItem(KEY, sid);
  }

  function findEls() {
    const totalEl = document.getElementById(TOTAL_ID);
    const onlineEl = document.getElementById(ONLINE_ID);
    return { totalEl, onlineEl };
  }

  async function ping(totalEl, onlineEl) {
    try {
      const r = await fetch("/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid }),
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(`API failed ${r.status}: ${t}`);
      }

      const data = await r.json();
      totalEl.textContent = typeof data.total === "number" ? data.total.toLocaleString() : "...";
      onlineEl.textContent = typeof data.online === "number" ? data.online.toLocaleString() : "...";
    } catch (e) {
      totalEl.textContent = "...";
      onlineEl.textContent = "...";
      console.error("[visitors] ping error:", e);
    }
  }

  function startWhenReady() {
    const { totalEl, onlineEl } = findEls();
    if (!totalEl || !onlineEl) {
      setTimeout(startWhenReady, 200);
      return;
    }

    ping(totalEl, onlineEl);
    setInterval(() => ping(totalEl, onlineEl), 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWhenReady);
  } else {
    startWhenReady();
  }
})();
