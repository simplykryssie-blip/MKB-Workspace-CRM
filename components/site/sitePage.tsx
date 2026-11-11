import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { MKB_PAGES, MKB_SETTINGS } from "@/lib/website/mkb-content";
import { MONARCH_PAGES, MONARCH_SETTINGS } from "@/lib/website/monarch-content";
import type { PublicSite } from "@/lib/server/website";
import type { SiteKey } from "@/lib/website/types";

/**
 * Shared by the public website routes: MKB's site (/site, or "/" on its own
 * domains) and Monarch's (/msite, or "/" on monarchtaxsuite.com).
 */
const BACKEND = process.env.NEXT_PUBLIC_BACKEND === "1";

async function load(site: SiteKey, slug: string): Promise<PublicSite | null> {
  if (BACKEND) {
    const [{ getEnv }, { publicPage }] = await Promise.all([import("@/lib/server/core"), import("@/lib/server/website")]);
    return publicPage(await getEnv(), slug, site);
  }
  const pages = site === "monarch" ? MONARCH_PAGES : MKB_PAGES;
  const p = pages.find((x) => x.slug === slug);
  if (!p) return null;
  return { settings: site === "monarch" ? MONARCH_SETTINGS : MKB_SETTINGS, page: p, sections: p.draft, nav: pages.filter((x) => x.nav && x.slug).map((x) => ({ slug: x.slug, title: x.title })) };
}
async function hostsFor(site: SiteKey): Promise<string[]> {
  const key = site === "monarch" ? "MONARCH_HOSTS" : "WEBSITE_HOSTS";
  let raw = process.env[key] ?? "";
  if (!raw && BACKEND) raw = ((await (await import("@/lib/server/core")).getEnv()) as unknown as Record<string, string | undefined>)[key] ?? "";
  return raw.toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
}
export const slugOf = (s?: string[]) => (s ?? []).join("/").toLowerCase();

const ICONS: Record<SiteKey, Metadata["icons"]> = {
  mkb: {
    icon: [{ url: "/brand/mkb-seal.ico", sizes: "any" }, { url: "/brand/mkb-seal-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/mkb-seal-192.png", sizes: "192x192", type: "image/png" }, { url: "/brand/mkb-seal-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/brand/mkb-seal-apple-180.png", sizes: "180x180" }],
  },
  monarch: {
    icon: [{ url: "/brand/monarch-icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/monarch-icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/brand/monarch-icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/brand/monarch-icon-apple-180.png", sizes: "180x180" }],
  },
};
const OG: Record<SiteKey, string> = { mkb: "/brand/mkb-seal-512.png", monarch: "/brand/monarch-icon-512.png" };

export async function siteMetadata(site: SiteKey, slug: string): Promise<Metadata> {
  const s = await load(site, slug).catch(() => null);
  if (!s) return { title: "Page not found", icons: ICONS[site] };
  const name = s.settings.siteName;
  return { title: { absolute: s.page.slug ? `${s.page.title} | ${name}` : `${name}${s.settings.tagline ? ` | ${s.settings.tagline}` : ""}` }, description: s.page.description || undefined, openGraph: { title: s.page.title, description: s.page.description, siteName: name, images: [{ url: OG[site], width: 512, height: 512 }] }, icons: ICONS[site] };
}

export async function SitePageView({ site, slug }: { site: SiteKey; slug: string }) {
  const s = await load(site, slug);
  if (!s) notFound();
  // On the website's own domain pages live at "/"; inside the app at /site (MKB) or /msite (Monarch).
  // Decided from the visitor's host (a header added by middleware isn't reliably passed on by every runtime).
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase().split(":")[0];
  const own = (await hostsFor(site)).includes(host) || h.get(site === "monarch" ? "x-monarch-site" : "x-mkb-site") === "1";
  return <SiteRenderer settings={s.settings} page={s.page} sections={s.sections} nav={s.nav} base={own ? "" : site === "monarch" ? "/msite" : "/site"} site={site} />;
}
