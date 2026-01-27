// js/snow.js
(() => {
  const canvas = document.getElementById("snow-canvas");
  if (!canvas) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduceMotion) return;

  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 1;

  const rand = (a, b) => a + Math.random() * (b - a);

  // chỉnh số bông tuyết
  let flakes = [];
  const baseCount = 120; // tăng/giảm tuỳ thích

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const areaFactor = Math.sqrt((w * h) / (1200 * 700));
    const count = Math.max(60, Math.round(baseCount * areaFactor));

    if (flakes.length === 0) {
      flakes = Array.from({ length: count }, () => makeFlake(true));
    } else {
      if (flakes.length < count) {
        const add = count - flakes.length;
        for (let i = 0; i < add; i++) flakes.push(makeFlake(true));
      } else if (flakes.length > count) {
        flakes.length = count;
      }
    }
  }

  function makeFlake(spawnAnywhere = false) {
    const r = rand(1, 3.2);
    return {
      x: rand(0, w),
      y: spawnAnywhere ? rand(0, h) : rand(-h, 0),
      r,
      vy: rand(0.8, 2.2) * (r / 2),     // tốc độ rơi
      vx: rand(-0.6, 0.6),             // gió ngang
      drift: rand(0.002, 0.01),        // lắc nhẹ
      phase: rand(0, Math.PI * 2),
      opacity: rand(0.35, 0.95),
    };
  }

  let last = performance.now();

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#ffffff";

    for (const f of flakes) {
      f.phase += f.drift;
      f.x += (f.vx + Math.sin(f.phase) * 0.3) * (dt * 60);
      f.y += f.vy * (dt * 60);

      // wrap
      if (f.y - f.r > h) {
        f.y = rand(-50, -10);
        f.x = rand(0, w);
      }
      if (f.x < -20) f.x = w + 20;
      if (f.x > w + 20) f.x = -20;

      ctx.globalAlpha = f.opacity;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  requestAnimationFrame(tick);
})();
