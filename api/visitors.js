// api/visitors.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { sid } = req.body || {};
    if (!sid) return res.status(400).json({ error: "Missing sid" });

    const UPSTASH_REDIS_REST_URL = process.env.KV_REST_API_URL;
    const UPSTASH_REDIS_REST_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
      return res.status(500).json({
        error: "Missing Upstash env vars",
        hasUrl: !!UPSTASH_REDIS_REST_URL,
        hasToken: !!UPSTASH_REDIS_REST_TOKEN,
      });
    }

    const now = Date.now();
    const windowMs = 60_000; 

    const onlineKey = "amadas:online:zset";
    const totalKey = "amadas:visits:total";

    const date = new Date().toISOString().slice(0, 10);
    const incOnceKey = `amadas:uniqueinc:${date}:${sid}`;

    const commands = [
      ["ZADD", onlineKey, now, sid],
      ["ZREMRANGEBYSCORE", onlineKey, 0, now - windowMs],
      ["ZCARD", onlineKey],

      ["SET", incOnceKey, "1", "NX", "EX", 172800], 
      ["INCR", totalKey],
      ["GET", totalKey],
    ];

    const resp = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return res.status(500).json({ error: "Upstash error", detail: t });
    }

    const data = await resp.json();

    const online = Number(data?.[2]?.result ?? 0);

    const setNxResult = data?.[3]?.result; 
    let total = Number(data?.[5]?.result ?? 0);

    if (setNxResult !== "OK") {
      const fix = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([["DECR", totalKey], ["GET", totalKey]]),
      });

      const fixData = await fix.json();
      total = Number(fixData?.[1]?.result ?? total);
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ total, online });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}