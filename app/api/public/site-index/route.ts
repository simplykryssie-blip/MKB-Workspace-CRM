import { getEnv, all } from "@/lib/server/core";
import { loadFunnels } from "@/lib/server/funnels";

/**
 * The MKB website's sitemap.xml and robots.txt (the middleware maps those addresses here on the
 * website's own domain). Built from the published, live pages, so it never lists deleted pages.
 */
const HIDE = new Set(["calculator"]);
export async function GET(req: Request) {
  const env = await getEnv();
  const url = new URL(req.url);
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "www.mkbfinancialgroup.com").split(",")[0].trim();
  const base = `https://${host}`;
  if ((url.searchParams.get("f") ?? req.headers.get("x-site-index")) === "robots") {
    const body = ["User-agent: *", "Allow: /", "Disallow: /i/", "Disallow: /u/", "Disallow: /w/", "Disallow: /f/", "Disallow: /api/", "", `Sitemap: ${base}/sitemap.xml`, ""].join("\n");
    return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
  }
  const pages = await all<{ slug: string; updated_at: string; published_at: string | null }>(env.DB, "SELECT slug, updated_at, published_at FROM website_pages WHERE site = 'mkb' AND deleted_at IS NULL AND published IS NOT NULL ORDER BY position");
  const urls = pages.filter((p) => !HIDE.has(p.slug) && !p.slug.startsWith("~")).map((p) => ({ loc: `${base}/${p.slug}`.replace(/\/$/, "/"), lastmod: (p.published_at ?? p.updated_at).slice(0, 10), pri: p.slug === "" ? "1.0" : ["tax-preparation", "bookkeeping", "payroll", "financial-management", "business-services"].includes(p.slug) ? "0.9" : "0.6" }));
  // Campaign pages that are switched on.
  const f = await loadFunnels(env).catch(() => null) as { moneyVault?: { enabled?: boolean }; creditVault?: { enabled?: boolean } } | null;
  const today = new Date().toISOString().slice(0, 10);
  if (f?.moneyVault?.enabled) urls.push({ loc: `${base}/unlock`, lastmod: today, pri: "0.7" });
  if (f?.creditVault?.enabled) urls.push({ loc: `${base}/black-friday`, lastmod: today, pri: "0.5" });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.pri}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
