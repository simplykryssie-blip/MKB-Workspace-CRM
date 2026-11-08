import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { MKB_PAGES, MKB_SETTINGS } from "@/lib/website/mkb-content";
import type { PublicSite } from "@/lib/server/website";
import "@/components/site/site.css";

export const dynamic = "force-dynamic";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND === "1";

/** Published content from the database; in the design preview, MKB's sample website. */
async function load(slug: string): Promise<PublicSite | null> {
  if (BACKEND) {
    const [{ getEnv }, { publicPage }] = await Promise.all([import("@/lib/server/core"), import("@/lib/server/website")]);
    return publicPage(await getEnv(), slug);
  }
  const p = MKB_PAGES.find((x) => x.slug === slug);
  if (!p) return null;
  return { settings: MKB_SETTINGS, page: p, sections: p.draft, nav: MKB_PAGES.filter((x) => x.nav && x.slug).map((x) => ({ slug: x.slug, title: x.title })) };
}
async function siteHosts(): Promise<string[]> {
  let raw = process.env.WEBSITE_HOSTS ?? "";
  if (!raw && BACKEND) raw = (await (await import("@/lib/server/core")).getEnv()).WEBSITE_HOSTS ?? "";
  return raw.toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
}
const slugOf = (s?: string[]) => (s ?? []).join("/").toLowerCase();
/** The website's own icon (MKB gold seal); the CRM keeps its app icon. */
const SITE_ICONS: Metadata["icons"] = {
  icon: [
    { url: "/brand/mkb-seal.ico", sizes: "any" },
    { url: "/brand/mkb-seal-32.png", sizes: "32x32", type: "image/png" },
    { url: "/brand/mkb-seal-192.png", sizes: "192x192", type: "image/png" },
    { url: "/brand/mkb-seal-512.png", sizes: "512x512", type: "image/png" },
  ],
  apple: [{ url: "/brand/mkb-seal-apple-180.png", sizes: "180x180" }],
};

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const site = await load(slugOf((await params).slug)).catch(() => null);
  if (!site) return { title: "Page not found", icons: SITE_ICONS };
  const name = site.settings.siteName;
  return { title: { absolute: site.page.slug ? `${site.page.title} | ${name}` : `${name}${site.settings.tagline ? ` | ${site.settings.tagline}` : ""}` }, description: site.page.description || undefined, openGraph: { title: site.page.title, description: site.page.description, siteName: name, images: [{ url: "/brand/mkb-seal-512.png", width: 512, height: 512 }] }, icons: SITE_ICONS };
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const site = await load(slugOf((await params).slug));
  if (!site) notFound();
  // On the website's own domain pages live at "/"; inside the app at "/site".
  // Decided from the visitor's host (a header added by middleware isn't reliably
  // passed on by every runtime).
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase().split(":")[0];
  const base = h.get("x-mkb-site") === "1" || (await siteHosts()).includes(host) ? "" : "/site";
  return <SiteRenderer settings={site.settings} page={site.page} sections={site.sections} nav={site.nav} base={base} />;
}
