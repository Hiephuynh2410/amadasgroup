// api/visitors.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Parse body chắc chắn (Vercel đôi khi req.body rỗng)
    const body = await readJsonBody(req);
    const sid = body?.sid;

    if (!sid) {
      return res.status(400).json({
        error: "Missing sid",
        hint: "Client must POST JSON: { sid: '...' }",
      });
    }

    // Nhận cả KV_* lẫn UPSTASH_* (tùy bạn connect kiểu nào)
    const REST_URL =
      process.env.KV_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL;

    const REST_TOKEN =
      process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!REST_URL || !REST_TOKEN) {
      return res.status(500).json({
        error: "Missing Redis REST env vars",
        needOneOf: {
          url: ["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"],
          token: ["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"],
        },
        has: {
          KV_REST_API_URL: !!process.env.KV_REST_API_URL,
          KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
          UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
          UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
          // cái này của bạn đang có nhưng không dùng cho REST:
          REDIS_URL: !!process.env.REDIS_URL,
        },
        fix: "Connect Vercel KV (Upstash) to project OR manually add REST env vars in Vercel → Project → Settings → Environment Variables.",
      });
    }

    const now = Date.now();
    const windowMs = 60_000;

    const onlineKey = "amadas:online:zset";
    const totalKey = "amadas:visits:total";

    const date = new Date().toISOString().slice(0, 10);
    const incOnceKey = `amadas:uniqueinc:${date}:${sid}`;

    // Pipeline: SET NX trước -> nếu OK mới INCR (khỏi rollback)
    const commands = [
      ["ZADD", onlineKey, now, sid],
      ["ZREMRANGEBYSCORE", onlineKey, 0, now - windowMs],
      ["ZCARD", onlineKey],

      ["SET", incOnceKey, "1", "NX", "EX", 172800], // 2 ngày
      ["GET", totalKey],
    ];

    const resp = await fetch(`${REST_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      // ✅ dạng object "commands" ổn định hơn
      body: JSON.stringify({ commands }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(500).json({
        error: "Redis REST error",
        status: resp.status,
        detail: t,
      });
    }

    const data = await resp.json();

    const online = Number(data?.result?.[2]?.result ?? data?.[2]?.result ?? 0);
    const setNxResult = data?.result?.[3]?.result ?? data?.[3]?.result; // "OK" hoặc null
    let total = Number(data?.result?.[4]?.result ?? data?.[4]?.result ?? 0);

    // Nếu SET NX thành công => tăng total và đọc lại
    if (setNxResult === "OK") {
      const resp2 = await fetch(`${REST_URL}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commands: [["INCR", totalKey], ["GET", totalKey]] }),
      });

      if (resp2.ok) {
        const data2 = await resp2.json();
        total = Number(data2?.result?.[1]?.result ?? data2?.[1]?.result ?? total);
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ total, online });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}

async function readJsonBody(req) {
  // Vercel đôi khi đã parse sẵn
  if (req.body && typeof req.body === "object") return req.body;

  // fallback: tự đọc stream
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// // api/visitors.js
// export default async function handler(req, res) {
//   try {
//     if (req.method !== "POST") {
//       res.setHeader("Allow", "POST");
//       return res.status(405).json({ error: "Method not allowed" });
//     }

//     const { sid } = req.body || {};
//     if (!sid) return res.status(400).json({ error: "Missing sid" });

//     const UPSTASH_REDIS_REST_URL = process.env.KV_REST_API_URL;
//     const UPSTASH_REDIS_REST_TOKEN = process.env.KV_REST_API_TOKEN;

//     if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
//       return res.status(500).json({
//         error: "Missing Upstash env vars",
//         hasUrl: !!UPSTASH_REDIS_REST_URL,
//         hasToken: !!UPSTASH_REDIS_REST_TOKEN,
//       });
//     }

//     const now = Date.now();
//     const windowMs = 60_000; 

//     const onlineKey = "amadas:online:zset";
//     const totalKey = "amadas:visits:total";

//     const date = new Date().toISOString().slice(0, 10);
//     const incOnceKey = `amadas:uniqueinc:${date}:${sid}`;

//     const commands = [
//       ["ZADD", onlineKey, now, sid],
//       ["ZREMRANGEBYSCORE", onlineKey, 0, now - windowMs],
//       ["ZCARD", onlineKey],

//       ["SET", incOnceKey, "1", "NX", "EX", 172800], 
//       ["INCR", totalKey],
//       ["GET", totalKey],
//     ];

//     const resp = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(commands),
//     });

//     if (!resp.ok) {
//       const t = await resp.text();
//       return res.status(500).json({ error: "Upstash error", detail: t });
//     }

//     const data = await resp.json();

//     const online = Number(data?.[2]?.result ?? 0);

//     const setNxResult = data?.[3]?.result; 
//     let total = Number(data?.[5]?.result ?? 0);

//     if (setNxResult !== "OK") {
//       const fix = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify([["DECR", totalKey], ["GET", totalKey]]),
//       });

//       const fixData = await fix.json();
//       total = Number(fixData?.[1]?.result ?? total);
//     }

//     res.setHeader("Cache-Control", "no-store");
//     return res.status(200).json({ total, online });
//   } catch (e) {
//     return res.status(500).json({ error: "Server error", detail: String(e) });
//   }
// }