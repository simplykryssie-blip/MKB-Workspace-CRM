/**
 * Public website pages, served as plain HTML. A page pasted in as full HTML is
 * sent exactly as written (links adjusted when shown inside the app, form tags
 * turned into frames). Section-built pages are rendered to static HTML with the
 * same design; their forms load in frames. Server-only.
 */
import { renderSectionsBody } from "@/lib/website/render";
import { MKB_PAGES, MKB_SETTINGS } from "@/lib/website/mkb-content";
import { MONARCH_PAGES, MONARCH_SETTINGS } from "@/lib/website/monarch-content";
import { isHtmlPage, type SiteKey } from "@/lib/website/types";
import { preparePage, WIDGET_SCRIPT } from "@/lib/website/html";
import type { PublicSite } from "./website";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND === "1";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

async function load(site: SiteKey, slug: string): Promise<PublicSite | null> {
  if (BACKEND) {
    const [{ getEnv }, { publicPage }] = await Promise.all([import("./core"), import("./website")]);
    return publicPage(await getEnv(), slug, site);
  }
  const pages = site === "monarch" ? MONARCH_PAGES : MKB_PAGES;
  const p = pages.find((x) => x.slug === slug);
  if (!p) return null;
  return { settings: site === "monarch" ? MONARCH_SETTINGS : MKB_SETTINGS, page: p, sections: p.draft, nav: pages.filter((x) => x.nav && x.slug).map((x) => ({ slug: x.slug, title: x.title })) };
}

async function ownHost(req: Request, site: SiteKey) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (req.headers.get(site === "monarch" ? "x-monarch-site" : "x-mkb-site") === "1") return true;
  const key = site === "monarch" ? "MONARCH_HOSTS" : "WEBSITE_HOSTS";
  let raw = process.env[key] ?? "";
  if (!raw && BACKEND) raw = ((await (await import("./core")).getEnv()) as unknown as Record<string, string | undefined>)[key] ?? "";
  return raw.toLowerCase().split(",").map((x) => x.trim()).includes(host);
}

const ICONS: Record<SiteKey, string> = {
  mkb: `<link rel="icon" href="/brand/mkb-seal.ico" sizes="any"><link rel="icon" type="image/png" sizes="192x192" href="/brand/mkb-seal-192.png"><link rel="apple-touch-icon" href="/brand/mkb-seal-apple-180.png">`,
  monarch: `<link rel="icon" type="image/png" sizes="32x32" href="/brand/monarch-icon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/brand/monarch-icon-192.png"><link rel="apple-touch-icon" href="/brand/monarch-icon-apple-180.png">`,
};
const OG: Record<SiteKey, string> = { mkb: "/brand/mkb-seal-512.png", monarch: "/brand/monarch-icon-512.png" };

const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin" } });

export async function serveSite(req: Request, site: SiteKey, slugParts?: string[]) {
  const slug = (slugParts ?? []).join("/").toLowerCase();
  const s = await load(site, slug).catch(() => null);
  const prefix = (await ownHost(req, site)) ? "" : site === "monarch" ? "/msite" : "/site";
  if (!s) return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title>${ICONS[site]}</head><body style="font-family:Arial,sans-serif;text-align:center;padding:80px 20px"><h1 style="font:500 34px Georgia,serif">Page not found</h1><p>This page doesn't exist.</p><p><a href="${prefix || "/"}">Go to the home page</a></p></body></html>`, 404);
  if (isHtmlPage(s.sections)) return html(preparePage(s.sections[0].html ?? "", prefix));
  const name = s.settings.siteName;
  const title = s.page.slug ? `${s.page.title} | ${name}` : `${name}${s.settings.tagline ? ` | ${s.settings.tagline}` : ""}`;
  const body = renderSectionsBody({ settings: s.settings, page: s.page, sections: s.sections, nav: s.nav, base: prefix, site });
  return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${s.page.description ? `<meta name="description" content="${esc(s.page.description)}">` : ""}<meta property="og:title" content="${esc(s.page.title)}"><meta property="og:site_name" content="${esc(name)}"><meta property="og:image" content="${OG[site]}">${ICONS[site]}<style>body{margin:0}</style></head><body>${body}${body.includes("data-mkb-frame") ? WIDGET_SCRIPT : ""}</body></html>`);
}
