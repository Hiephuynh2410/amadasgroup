const SITE_ORIGIN = "https://amadas.vercel.app";
const BLOG_PATH = "/layout/blog/blog.html";

const POSTS = {
  "post-01": {
    title: "AI Research Collaboration with Provincial General Hospitals",
    description:
      "AMaDaS Research Group establishes collaboration with provincial general hospitals to develop AI-based models for supporting breast cancer diagnosis using medical imaging data.",
    image: `${SITE_ORIGIN}/img/blog/Ai1.jpg`,
  },
  "post-02": {
    title: "Research Highlights and Academic Activities – Jan 2026",
    description:
      "In January 2026, the research group recorded several notable academic outcomes with manuscripts accepted at international and national conferences.",
    image: `${SITE_ORIGIN}/img/blog/YEP.jpg`,
  },
};

// Bot detector (Facebook/Twitter/Slack/Discord…)
function isCrawler(userAgent = "") {
  const ua = String(userAgent).toLowerCase();
  return /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|pinterest|googlebot|bingbot/i.test(
    ua
  );
}

function escHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

module.exports = (req, res) => {
  const raw = req.query && req.query.id ? req.query.id : "";
  const idRaw = Array.isArray(raw) ? raw[0] : String(raw || "");
  const id = decodeURIComponent(idRaw).trim();

  const safeId = POSTS[id] ? id : "post-01";
  const post = POSTS[safeId];

  const redirectUrl = `${SITE_ORIGIN}${BLOG_PATH}?post=${encodeURIComponent(safeId)}`;

  const shareUrl = `${SITE_ORIGIN}/api/share/${encodeURIComponent(safeId)}`;

  if (isCrawler(req.headers["user-agent"])) {
    const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escHtml(post.title)}</title>

  <meta property="og:site_name" content="AMaDaS Blog" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escHtml(post.title)}" />
  <meta property="og:description" content="${escHtml(post.description)}" />
  <meta property="og:image" content="${escHtml(post.image)}" />
  <meta property="og:url" content="${escHtml(shareUrl)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(post.title)}" />
  <meta name="twitter:description" content="${escHtml(post.description)}" />
  <meta name="twitter:image" content="${escHtml(post.image)}" />

  <link rel="canonical" href="${escHtml(redirectUrl)}" />
</head>
<body>
  <p>${escHtml(post.title)}</p>
  <p><a href="${escHtml(redirectUrl)}">Open article</a></p>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, must-revalidate");
    res.status(200).send(html);
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(302).setHeader("Location", redirectUrl).end();
};
