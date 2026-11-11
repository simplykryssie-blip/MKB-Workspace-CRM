/**
 * Public website — server side. Staff edit drafts with Company Settings
 * permissions ("view" to open the editor, "edit" to change drafts and upload
 * images, "approve" to publish). Visitors only ever receive published content.
 * Server-only.
 */
import { MKB_PAGES, MKB_SETTINGS } from "@/lib/website/mkb-content";
import { MONARCH_PAGES, MONARCH_SETTINGS } from "@/lib/website/monarch-content";
import { PAGE_LIMIT, cleanSections, cleanSettings, slugifyPage, type Section, type SiteKey, type SitePage, type SiteSettings, type Website } from "@/lib/website/types";
import type { ActionKey } from "@/lib/team/config";
import { all, badRequest, HttpError, json, notFound, now, one, run, str, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { audit, requirePermission, type Actor } from "./identity";

type PageRow = { id: string; slug: string; title: string; description: string; nav: number; hide_nav: number; position: number; draft: string; published: string | null; rev: number; updated_at: string; published_at: string | null };
type SettingsRow = { draft: string; published: string | null; rev: number; published_at: string | null };
const toPage = (r: PageRow): SitePage => ({ id: r.id, slug: r.slug, title: r.title, description: r.description, nav: !!r.nav, hideNav: !!r.hide_nav, position: r.position, draft: json(r.draft, []), published: r.published ? json(r.published, []) : null, rev: r.rev, updatedAt: r.updated_at, publishedAt: r.published_at ?? undefined });
const RESERVED = new Set(["api", "site", "login", "f", "dashboard", "clients", "leads", "forms", "team", "services", "website", "_next", "brand", "media"]);
const memberId = (a: Actor) => (a.kind === "staff" ? a.member.id : null);
/** Settings row of each website. */
const SID = (site: SiteKey) => (site === "monarch" ? 2 : 1);
/** MKB's website is part of Company Settings; Monarch's belongs to the Monarch workspace. */
const perm = (a: Actor, site: SiteKey, action: ActionKey) => requirePermission(a, site === "monarch" ? "monarch" : "settings", action);
const DEFAULTS = (site: SiteKey) => (site === "monarch" ? MONARCH_SETTINGS : MKB_SETTINGS);
export const siteParam = (req: Request): SiteKey => (new URL(req.url).searchParams.get("site") === "monarch" ? "monarch" : "mkb");

/* ---------------------------------------------------------------- staff */
export async function getWebsite(env: AppEnv, a: Actor, site: SiteKey = "mkb"): Promise<Website> {
  perm(a, site, "view");
  const [s, pages] = await Promise.all([
    one<SettingsRow>(env.DB, "SELECT draft, published, rev, published_at FROM website_settings WHERE id = ?", SID(site)),
    all<PageRow>(env.DB, "SELECT * FROM website_pages WHERE site = ? AND deleted_at IS NULL ORDER BY position, title", site),
  ]);
  return {
    settings: s ? { draft: json(s.draft, DEFAULTS(site)), published: s.published ? json(s.published, null) : null, rev: s.rev, publishedAt: s.published_at ?? undefined } : { draft: cleanSettings({}), published: null, rev: 0 },
    pages: pages.map(toPage),
  };
}

export async function saveSettings(env: AppEnv, a: Actor, b: { settings?: Partial<SiteSettings>; rev?: number }, site: SiteKey = "mkb") {
  perm(a, site, "edit");
  const data = JSON.stringify(cleanSettings(b.settings, DEFAULTS(site).siteName));
  const t = now();
  const cur = await one<{ rev: number }>(env.DB, "SELECT rev FROM website_settings WHERE id = ?", SID(site));
  if (!cur) {
    await run(env.DB, "INSERT INTO website_settings (id, draft, rev, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)", SID(site), data, t, memberId(a));
    return { rev: 1 };
  }
  const r = await run(env.DB, "UPDATE website_settings SET draft = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE id = ? AND rev = ?", data, t, memberId(a), SID(site), Number(b.rev));
  if (!r.meta.changes) throw new HttpError(409, "Someone else changed the website settings. The latest version has been loaded.", "conflict");
  return { rev: cur.rev + 1 };
}

async function cleanPage(env: AppEnv, p: Partial<SitePage>, id: string, site: SiteKey) {
  const title = str(p.title, 120);
  if (!title) throw badRequest("Give the page a title.");
  const isHome = (await one<{ slug: string }>(env.DB, "SELECT slug FROM website_pages WHERE id = ?", id))?.slug === "";
  const slug = isHome ? "" : slugifyPage(str(p.slug, 60) || title);
  if (!isHome && !slug) throw badRequest("Give the page a web address (letters and numbers).");
  if (RESERVED.has(slug)) throw badRequest(`“${slug}” is reserved — choose another web address.`);
  if (await one(env.DB, "SELECT 1 FROM website_pages WHERE site = ? AND slug = ? AND id != ? AND deleted_at IS NULL", site, slug, id)) throw new HttpError(409, "Another page already uses that web address.", "duplicate");
  const draft = cleanSections(p.draft);
  const draftJson = JSON.stringify(draft);
  if (draftJson.length > PAGE_LIMIT) throw badRequest("This page is too large. Split it into two pages.");
  return { slug, title, description: str(p.description, 300), nav: p.nav ? 1 : 0, hideNav: p.hideNav ? 1 : 0, position: Math.max(0, Math.min(999, Math.round(Number(p.position) || 0))), draftJson };
}

export async function createPage(env: AppEnv, a: Actor, p: Partial<SitePage>, site: SiteKey = "mkb") {
  perm(a, site, "edit");
  if (!/^pg-[A-Za-z0-9_-]{2,40}$/.test(p.id ?? "")) throw badRequest("Invalid page ID.");
  if (await one(env.DB, "SELECT 1 FROM website_pages WHERE id = ?", p.id)) throw new HttpError(409, "That page already exists.", "exists");
  if (str(p.slug, 60) === "") throw badRequest("Give the page a web address.");
  const c = await cleanPage(env, p, p.id!, site);
  const t = now();
  await run(env.DB, "INSERT INTO website_pages (id, site, slug, title, description, nav, hide_nav, position, draft, rev, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)", p.id, site, c.slug, c.title, c.description, c.nav, c.hideNav, c.position, c.draftJson, t, memberId(a));
  await audit(env.DB, a, { action: "Website update", resource: `Website page “${c.title}”`, meta: "Page created (draft)" });
  return { rev: 1, slug: c.slug };
}

export async function savePage(env: AppEnv, a: Actor, id: string, b: { page?: Partial<SitePage>; rev?: number }, site: SiteKey = "mkb") {
  perm(a, site, "edit");
  const cur = await one<{ rev: number }>(env.DB, "SELECT rev FROM website_pages WHERE id = ? AND site = ? AND deleted_at IS NULL", id, site);
  if (!cur) throw notFound("Page not found.");
  const c = await cleanPage(env, b.page ?? {}, id, site);
  const r = await run(env.DB, "UPDATE website_pages SET slug = ?, title = ?, description = ?, nav = ?, hide_nav = ?, position = ?, draft = ?, rev = rev + 1, updated_at = ?, updated_by = ? WHERE id = ? AND rev = ? AND deleted_at IS NULL", c.slug, c.title, c.description, c.nav, c.hideNav, c.position, c.draftJson, now(), memberId(a), id, Number(b.rev));
  if (!r.meta.changes) throw new HttpError(409, "Someone else changed this page. The latest version has been loaded.", "conflict");
  return { rev: cur.rev + 1, slug: c.slug };
}

/** Removes a page from the editor and the live site (kept in the database, hidden). The home page can't be deleted. */
export async function deletePage(env: AppEnv, a: Actor, id: string, site: SiteKey = "mkb") {
  perm(a, site, "approve");
  const p = await one<{ slug: string; title: string }>(env.DB, "SELECT slug, title FROM website_pages WHERE id = ? AND site = ? AND deleted_at IS NULL", id, site);
  if (!p) throw notFound("Page not found.");
  if (p.slug === "") throw badRequest("The home page can't be deleted.");
  await run(env.DB, "UPDATE website_pages SET deleted_at = ?, slug = ?, published = NULL, updated_by = ? WHERE id = ?", now(), `~deleted-${id}`, memberId(a), id);
  await audit(env.DB, a, { action: "Website publish", resource: `Website page “${p.title}”`, meta: "Page deleted (removed from the live site)" });
}

/**
 * Publishes drafts. Without `pageIds`: the settings and every page that is already
 * live (draft pages stay drafts). With `pageIds`: those pages (this is how a draft
 * page goes live) plus the settings.
 */
export async function publish(env: AppEnv, a: Actor, b: { pageIds?: string[] }, site: SiteKey = "mkb") {
  perm(a, site, "approve");
  const t = now();
  const ids = Array.isArray(b.pageIds) ? b.pageIds.map((x) => str(x, 60)) : null;
  const st = [env.DB.prepare("UPDATE website_settings SET published = draft, published_at = ? WHERE id = ?").bind(t, SID(site))];
  if (ids) for (const id of ids) st.push(env.DB.prepare("UPDATE website_pages SET published = draft, published_at = ? WHERE id = ? AND site = ? AND deleted_at IS NULL").bind(t, id, site));
  else st.push(env.DB.prepare("UPDATE website_pages SET published = draft, published_at = ? WHERE site = ? AND deleted_at IS NULL AND published IS NOT NULL").bind(t, site));
  await env.DB.batch(st);
  await audit(env.DB, a, { action: "Website publish", resource: site === "monarch" ? "Monarch website" : "Public website", meta: ids ? `Published ${ids.length} page(s)` : "Published changes to live pages" });
  return { publishedAt: t };
}

/** Takes one page off the live site (draft kept). */
export async function unpublishPage(env: AppEnv, a: Actor, id: string, site: SiteKey = "mkb") {
  perm(a, site, "approve");
  const p = await one<{ slug: string; title: string }>(env.DB, "SELECT slug, title FROM website_pages WHERE id = ? AND site = ? AND deleted_at IS NULL", id, site);
  if (!p) throw notFound("Page not found.");
  if (p.slug === "") throw badRequest("The home page can't be taken offline.");
  await run(env.DB, "UPDATE website_pages SET published = NULL, published_at = NULL WHERE id = ?", id);
  await audit(env.DB, a, { action: "Website publish", resource: `Website page “${p.title}”`, meta: "Taken off the live site" });
}

/**
 * First-time load of MKB's existing website (rebuilt from the old platform) into an
 * empty website, published as-is since it's already public; also creates the
 * "Website contact" form (answers become leads for the person loading it).
 */
export async function importMkb(env: AppEnv, a: Actor) {
  requirePermission(a, "settings", "approve");
  requirePermission(a, "leads", "edit");
  if (await one(env.DB, "SELECT 1 FROM website_pages WHERE site = 'mkb' LIMIT 1")) throw new HttpError(409, "The website already has pages.", "exists");
  const t = now();
  const by = memberId(a);
  const st: D1PreparedStatement[] = [];
  const settings = JSON.stringify(MKB_SETTINGS);
  st.push(env.DB.prepare("INSERT INTO website_settings (id, draft, published, rev, updated_at, updated_by, published_at) VALUES (1, ?, ?, 1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET draft = excluded.draft, published = excluded.published, rev = rev + 1, updated_at = excluded.updated_at, published_at = excluded.published_at").bind(settings, settings, t, by, t));
  for (const p of MKB_PAGES) {
    const d = JSON.stringify(cleanSections(p.draft));
    // Draft-only pages (e.g. the WISP funnel) are loaded without a published copy.
    st.push(env.DB.prepare("INSERT INTO website_pages (id, site, slug, title, description, nav, hide_nav, position, draft, published, rev, updated_at, updated_by, published_at) VALUES (?, 'mkb', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)").bind(p.id, p.slug, p.title, p.description, p.nav ? 1 : 0, p.hideNav ? 1 : 0, p.position, d, p.published ? d : null, t, by, p.published ? t : null));
  }
  if (!(await one(env.DB, "SELECT 1 FROM forms WHERE slug = 'contact'"))) {
    const stage = await one<{ id: string }>(env.DB, "SELECT id FROM lead_stages ORDER BY position LIMIT 1");
    const f = (n: number) => `fld-web${n}`;
    const fields = [
      { id: f(1), type: "text", label: "Full name", required: true, map: "fullName" },
      { id: f(2), type: "email", label: "Email", required: true, map: "email" },
      { id: f(3), type: "phone", label: "Phone", required: true, map: "phone" },
      { id: f(4), type: "text", label: "Business name (if you have one)", required: false, map: "businessName" },
      { id: f(5), type: "services", label: "What can we help with?", required: false, map: "services" },
      { id: f(6), type: "textarea", label: "Tell us a little about what you need", required: false, map: "notes" },
      { id: f(7), type: "consent", label: "I agree that MKB Financial Group may contact me by phone, text or email about my request. Message and data rates may apply. I can opt out at any time.", required: true, map: "none" },
    ];
    st.push(env.DB.prepare("INSERT INTO forms (id, name, slug, title, intro, status, fields, services, routing, thank_you, created_at, updated_at, published_at) VALUES (?, 'Website contact', 'contact', 'Let''s talk about your business', NULL, 'published', ?, '[]', ?, ?, ?, ?, ?)").bind(
      `form-web${Date.now().toString(36)}`, JSON.stringify(fields),
      JSON.stringify({ ownerId: by, stageId: stage?.id ?? "st-new", source: "Website", sourceDetail: "Website contact form", tags: ["Website"], followUpHours: 24 }),
      "Thank you! We'll be in touch within one business day.", t, t, t));
  }
  st.push(...(await calculatorFormStatements(env, by, t)));
  await env.DB.batch(st);
  await audit(env.DB, a, { action: "Website publish", resource: "Public website", meta: `Loaded MKB's website (${MKB_PAGES.length} pages)` });
}

/**
 * Starts Monarch's website from a template: settings and pages as drafts
 * (nothing is public until someone presses Publish).
 */
export async function startMonarch(env: AppEnv, a: Actor) {
  perm(a, "monarch", "approve");
  if (await one(env.DB, "SELECT 1 FROM website_pages WHERE site = 'monarch' LIMIT 1")) throw new HttpError(409, "Monarch's website already has pages.", "exists");
  const t = now();
  const by = memberId(a);
  const st: D1PreparedStatement[] = [env.DB.prepare("INSERT INTO website_settings (id, draft, rev, updated_at, updated_by) VALUES (2, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET draft = excluded.draft, rev = rev + 1, updated_at = excluded.updated_at").bind(JSON.stringify(MONARCH_SETTINGS), t, by)];
  for (const p of MONARCH_PAGES) st.push(env.DB.prepare("INSERT INTO website_pages (id, site, slug, title, description, nav, hide_nav, position, draft, rev, updated_at, updated_by) VALUES (?, 'monarch', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(p.id, p.slug, p.title, p.description, p.nav ? 1 : 0, p.hideNav ? 1 : 0, p.position, JSON.stringify(cleanSections(p.draft)), t, by));
  await env.DB.batch(st);
  await audit(env.DB, a, { action: "Website update", resource: "Monarch website", meta: `Started from the template (${MONARCH_PAGES.length} draft pages)` });
}

/** The lead form on the tax calculator funnel's first page (answers become MKB leads). */
export async function calculatorFormStatements(env: AppEnv, ownerId: string | null, t: string): Promise<D1PreparedStatement[]> {
  if (await one(env.DB, "SELECT 1 FROM forms WHERE slug = 'tax-calculator'")) return [];
  const stage = await one<{ id: string }>(env.DB, "SELECT id FROM lead_stages ORDER BY position LIMIT 1");
  const fields = [
    { id: "fld-calc1", type: "text", label: "Full name", required: true, map: "fullName" },
    { id: "fld-calc2", type: "email", label: "Email", required: true, map: "email" },
    { id: "fld-calc3", type: "phone", label: "Phone", required: true, map: "phone" },
    { id: "fld-calc4", type: "consent", label: "I agree that MKB Financial Group may contact me by phone, text or email about my taxes. Message and data rates may apply. I can opt out at any time.", required: true, map: "none" },
  ];
  return [env.DB.prepare("INSERT INTO forms (id, name, slug, title, intro, status, fields, services, routing, thank_you, created_at, updated_at, published_at) VALUES (?, 'Tax calculator', 'tax-calculator', 'Open the free tax calculator', NULL, 'published', ?, '[\"tax\"]', ?, 'Thanks! Opening the calculator…', ?, ?, ?)").bind(
    `form-calc${Date.now().toString(36)}`, JSON.stringify(fields),
    JSON.stringify({ ownerId, stageId: stage?.id ?? "st-new", source: "Website", sourceDetail: "Tax calculator", tags: ["Website", "Tax calculator"], followUpHours: 24 }), t, t, t)];
}

/* ---------------------------------------------------------------- images */
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
export async function uploadMedia(env: AppEnv, a: Actor, req: Request, site: SiteKey = "mkb") {
  perm(a, site, "edit");
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = IMAGE_TYPES[type];
  if (!ext) throw new HttpError(415, "Upload a PNG, JPG, WebP or GIF image.", "bad_type");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 5_000_000) throw new HttpError(413, "Images can be up to 5 MB.");
  const buf = await req.arrayBuffer();
  if (buf.byteLength > 5_000_000) throw new HttpError(413, "Images can be up to 5 MB.");
  if (!buf.byteLength) throw badRequest("The file is empty.");
  const key = `${randomId("img").replace("img_", "")}.${ext}`;
  await env.FILES.put(`website/${key}`, buf, { httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" } });
  const name = str(decodeURIComponent(req.headers.get("x-file-name") ?? ""), 200) || key;
  await run(env.DB, "INSERT INTO website_media (key, content_type, size, name, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)", key, type, buf.byteLength, name, now(), memberId(a));
  await audit(env.DB, a, { action: "Website update", resource: "Website image", meta: `Uploaded ${name}` });
  return { url: `/site/media/${key}` };
}

/** Public: a website image. Only files registered as website media are served. */
export async function getMedia(env: AppEnv, key: string) {
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|webp|gif)$/.test(key)) return null;
  if (!(await one(env.DB, "SELECT 1 FROM website_media WHERE key = ?", key))) return null;
  return env.FILES.get(`website/${key}`);
}

/* ---------------------------------------------------------------- public */
export type PublicSite = { settings: SiteSettings; page: { slug: string; title: string; description: string; hideNav?: boolean }; sections: Section[]; nav: { slug: string; title: string }[] };
/** What visitors see: published settings and page, or null (not found / never published). */
export async function publicPage(env: AppEnv, slug: string, site: SiteKey = "mkb"): Promise<PublicSite | null> {
  const [s, pages] = await Promise.all([
    one<{ published: string | null }>(env.DB, "SELECT published FROM website_settings WHERE id = ?", SID(site)),
    all<{ slug: string; title: string; description: string; nav: number; hide_nav: number; published: string | null }>(env.DB, "SELECT slug, title, description, nav, hide_nav, published FROM website_pages WHERE site = ? AND deleted_at IS NULL AND published IS NOT NULL ORDER BY position, title", site),
  ]);
  if (!s?.published) return null;
  const p = pages.find((x) => x.slug === slug);
  if (!p) return null;
  return {
    settings: json(s.published, DEFAULTS(site)),
    page: { slug: p.slug, title: p.title, description: p.description, hideNav: !!p.hide_nav },
    sections: json(p.published, []),
    nav: pages.filter((x) => x.nav && x.slug).map((x) => ({ slug: x.slug, title: x.title })),
  };
}
