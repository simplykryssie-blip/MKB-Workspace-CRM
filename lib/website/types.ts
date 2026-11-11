/**
 * Public website — content model shared by the editor, the server and the public
 * pages. A page is a list of sections; every section type uses the same small set
 * of fields so the editor stays simple. Content is public marketing copy only.
 */

export const SECTION_TYPES = [
  { key: "hero", label: "Top banner", hint: "Big headline, intro and buttons, with an optional photo." },
  { key: "text", label: "Text", hint: "Heading and paragraphs." },
  { key: "cards", label: "Cards", hint: "A grid of short items (services, steps, values)." },
  { key: "pricing", label: "Prices", hint: "Packages with a price each." },
  { key: "faq", label: "Questions", hint: "Questions and answers that open on tap." },
  { key: "cta", label: "Call to action", hint: "Gold band with a headline and a button." },
  { key: "form", label: "Contact form", hint: "One of your published Forms; answers become Leads." },
  { key: "embed", label: "Custom code", hint: "Your own HTML, shown in a sealed frame." },
] as const;
export type SectionType = (typeof SECTION_TYPES)[number]["key"];
export const TONES = [
  { key: "light", label: "White" },
  { key: "warm", label: "Cream" },
  { key: "dark", label: "Black" },
] as const;
export type Tone = (typeof TONES)[number]["key"];

export type SiteButton = { label: string; href: string; style?: "gold" | "dark" | "outline" };
export type SiteItem = { label?: string; title: string; body?: string; price?: string; unit?: string; featured?: boolean };
export type Section = {
  id: string;
  type: SectionType;
  tone?: Tone;
  eyebrow?: string;
  title?: string;
  /** Plain text; a blank line starts a new paragraph. */
  body?: string;
  buttons?: SiteButton[];
  items?: SiteItem[];
  columns?: 2 | 3 | 4;
  note?: string;
  image?: string;
  formSlug?: string;
  html?: string;
  height?: number;
};

export type SiteSettings = {
  siteName: string;
  tagline: string;
  topBar: string;
  logo: string;
  phone: string;
  email: string;
  location: string;
  facebook: string;
  instagram: string;
  footerBlurb: string;
  /** Main header button. */
  ctaLabel: string;
  ctaHref: string;
  bookingLabel: string;
  bookingHref: string;
  /** Leave empty to hide the "Client Portal Sign In" link. */
  portalHref: string;
};

export type SitePage = {
  id: string;
  slug: string; // "" = home page
  title: string;
  description: string;
  nav: boolean;
  position: number;
  draft: Section[];
  published: Section[] | null;
  publishedAt?: string;
  rev: number;
  updatedAt?: string;
};

/** Which public website: MKB Financial Group or Monarch Tax Suite. */
export type SiteKey = "mkb" | "monarch";

export type Website = { settings: { draft: SiteSettings; published: SiteSettings | null; rev: number; publishedAt?: string }; pages: SitePage[] };

/* ---------------------------------------------------------------- validation (server and editor) */
const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");
export const slugifyPage = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
/** Links: site paths (/bookkeeping), https://, mailto: and tel: only. */
export function cleanHref(v: unknown): string {
  const h = s(v, 500);
  if (!h) return "";
  if (/^\/(?!\/)/.test(h) || /^https:\/\//i.test(h) || /^mailto:[^\s]+$/i.test(h) || /^tel:[+\d\s().-]+$/i.test(h)) return h;
  if (/^http:\/\//i.test(h)) return h.replace(/^http:/i, "https:");
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(h)) return `https://${h}`;
  return "";
}
/** Images: https addresses, files uploaded to the site (/site/media/...) or the built-in brand images (/brand/...). */
export const cleanImage = (v: unknown) => {
  const h = s(v, 600);
  return /^https:\/\//i.test(h) || /^\/(site\/media|brand)\/[A-Za-z0-9._-]+$/.test(h) ? h : "";
};

export function cleanSection(x: Partial<Section>): Section {
  const type = (SECTION_TYPES.map((t) => t.key) as string[]).includes(x.type as string) ? (x.type as SectionType) : "text";
  const out: Section = { id: s(x.id, 40) || `sec-${Math.random().toString(36).slice(2, 9)}`, type };
  const tone = (TONES.map((t) => t.key) as string[]).includes(x.tone as string) ? (x.tone as Tone) : undefined;
  if (tone) out.tone = tone;
  for (const k of ["eyebrow", "title", "note"] as const) if (s(x[k], 300)) out[k] = s(x[k], 300);
  if (s(x.body, 6000)) out.body = s(x.body, 6000);
  if (Array.isArray(x.buttons)) out.buttons = x.buttons.slice(0, 4).map((b) => ({ label: s(b?.label, 60), href: cleanHref(b?.href), style: (["gold", "dark", "outline"] as const).includes(b?.style as "gold") ? b.style : undefined })).filter((b) => b.label && b.href);
  if (Array.isArray(x.items))
    out.items = x.items.slice(0, 24).map((i) => {
      const it: SiteItem = { title: s(i?.title, 200) };
      if (s(i?.label, 80)) it.label = s(i.label, 80);
      if (s(i?.body, 2000)) it.body = s(i.body, 2000);
      if (s(i?.price, 40)) it.price = s(i.price, 40);
      if (s(i?.unit, 40)) it.unit = s(i.unit, 40);
      if (i?.featured) it.featured = true;
      return it;
    }).filter((i) => i.title || i.body);
  if ([2, 3, 4].includes(Number(x.columns))) out.columns = Number(x.columns) as 2 | 3 | 4;
  if (cleanImage(x.image)) out.image = cleanImage(x.image);
  if (s(x.formSlug, 60)) out.formSlug = slugifyPage(s(x.formSlug, 60));
  if (type === "embed") {
    out.html = typeof x.html === "string" ? x.html.slice(0, 60000) : "";
    out.height = Math.min(4000, Math.max(200, Math.round(Number(x.height) || 900)));
  }
  return out;
}
export function cleanSections(v: unknown): Section[] {
  if (!Array.isArray(v)) return [];
  const out = v.slice(0, 40).map((x) => cleanSection(x ?? {}));
  const seen = new Set<string>();
  return out.map((x) => (seen.has(x.id) ? { ...x, id: `sec-${Math.random().toString(36).slice(2, 9)}` } : (seen.add(x.id), x)));
}
export function cleanSettings(v: Partial<SiteSettings> | undefined, fallbackName = "MKB Financial Group"): SiteSettings {
  const x = v ?? {};
  return {
    siteName: s(x.siteName, 120) || fallbackName,
    tagline: s(x.tagline, 120),
    topBar: s(x.topBar, 160),
    logo: cleanImage(x.logo),
    phone: s(x.phone, 40),
    email: s(x.email, 200),
    location: s(x.location, 120),
    facebook: cleanHref(x.facebook),
    instagram: cleanHref(x.instagram),
    footerBlurb: s(x.footerBlurb, 300),
    ctaLabel: s(x.ctaLabel, 60),
    ctaHref: cleanHref(x.ctaHref),
    bookingLabel: s(x.bookingLabel, 60),
    bookingHref: cleanHref(x.bookingHref),
    portalHref: cleanHref(x.portalHref),
  };
}
/** Total size limit for one page (keeps the database row small). */
export const PAGE_LIMIT = 200_000;
