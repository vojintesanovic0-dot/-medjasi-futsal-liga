import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SITE_URL = "https://vojintesanovic0-dot.github.io/-medjasi-futsal-liga/";
const FALLBACK_IMAGE = SITE_URL + "images/icon-512.png";

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return htmlResponse("<!doctype html><html lang=\"bs\"><meta charset=\"utf-8\"><title>Vijest nije pronađena</title><p>Neispravan link vijesti.</p><a href=\"" + SITE_URL + "\">Otvori Međasi Futsal Ligu</a></html>", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) {
    return htmlResponse("<!doctype html><html lang=\"bs\"><meta charset=\"utf-8\"><title>Međasi Futsal Liga</title><p>Vijest trenutno nije dostupna.</p><a href=\"" + SITE_URL + "\">Otvori stranicu</a></html>", 503);
  }

  let news: { id: string; title: string; lead: string | null; body: string | null; media_url: string | null; media_type: string | null } | null = null;
  try {
    const endpoint = new URL("/rest/v1/news", supabaseUrl);
    endpoint.searchParams.set("select", "id,title,lead,body,media_url,media_type");
    endpoint.searchParams.set("id", "eq." + id);
    endpoint.searchParams.set("published", "eq.true");
    endpoint.searchParams.set("limit", "1");
    const response = await fetch(endpoint, {
      headers: { apikey: anonKey, Authorization: "Bearer " + anonKey },
    });
    if (!response.ok) throw new Error("News lookup failed: " + response.status);
    const rows = await response.json();
    news = Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (error) {
    console.error("share-news lookup failed", error);
    return htmlResponse("<!doctype html><html lang=\"bs\"><meta charset=\"utf-8\"><title>Međasi Futsal Liga</title><p>Vijest trenutno nije dostupna.</p><a href=\"" + SITE_URL + "\">Otvori stranicu</a></html>", 503);
  }

  if (!news) {
    return htmlResponse("<!doctype html><html lang=\"bs\"><meta charset=\"utf-8\"><title>Vijest nije pronađena</title><p>Vijest ne postoji ili nije javno objavljena.</p><a href=\"" + SITE_URL + "\">Otvori Međasi Futsal Ligu</a></html>", 404);
  }

  const title = String(news.title || "Vijest");
  const description = String(news.lead || news.body || "Pročitajte najnovije vijesti Međasi Futsal Lige.").replace(/\s+/g, " ").slice(0, 300);
  let image = news.media_type === "image" && /^https:\/\//i.test(String(news.media_url || ""))
    ? String(news.media_url)
    : FALLBACK_IMAGE;
  // Keep og:image as the exact public media URL; query parameters on storage images can break some chat preview fetchers.
  const canonical = SITE_URL + "?news=" + encodeURIComponent(id);
  const shareUrl = url.origin + url.pathname + url.search;
  const bot = /facebookexternalhit|facebot|twitterbot|whatsapp|viber|telegrambot|linkedinbot|slackbot|discordbot|googlebot|bingbot|crawler|spider/i.test(req.headers.get("user-agent") || "");

  const html = `<!doctype html>
<html lang="bs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Međasi Futsal Liga</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Međasi Futsal Liga">
<meta property="og:locale" content="sr_Latn">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(shareUrl)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:image:type" content="image/png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="twitter:image:alt" content="${esc(title)}">
<style>body{font:16px system-ui,sans-serif;background:#0a120d;color:#f4fff7;padding:2rem;max-width:720px;margin:auto}a{color:#7be495}img{max-width:100%;border-radius:12px}</style>
</head>
<body>
<h1>${esc(title)}</h1>
<img src="${esc(image)}" alt="${esc(title)}" style="display:block;width:100%;height:auto;max-height:630px;object-fit:cover;margin:1rem 0">
<p>${esc(description)}</p>
<a href="${esc(canonical)}">Otvori vijest na Međasi Futsal Ligi</a>
${bot ? "" : "<script>setTimeout(function(){window.location.replace(" + JSON.stringify(canonical) + ");},250);</script>"}
</body>
</html>`;
  return htmlResponse(html);
});
