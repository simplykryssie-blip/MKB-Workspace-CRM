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
const slugOf = (s?: string[]) => (s ?? []).join("/").toLowerCase();

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const site = await load(slugOf((await params).slug)).catch(() => null);
  if (!site) return { title: "Page not found" };
  const name = site.settings.siteName;
  return { title: { absolute: site.page.slug ? `${site.page.title} | ${name}` : `${name}${site.settings.tagline ? ` | ${site.settings.tagline}` : ""}` }, description: site.page.description || undefined, openGraph: { title: site.page.title, description: site.page.description, siteName: name } };
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const site = await load(slugOf((await params).slug));
  if (!site) notFound();
  // On the website's own domain pages live at "/"; inside the app at "/site".
  const base = (await headers()).get("x-mkb-site") === "1" ? "" : "/site";
  return <SiteRenderer settings={site.settings} page={site.page} sections={site.sections} nav={site.nav} base={base} />;
}
