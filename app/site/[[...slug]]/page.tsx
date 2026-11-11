import type { Metadata } from "next";
import { SitePageView, siteMetadata, slugOf } from "@/components/site/sitePage";
import "@/components/site/site.css";

export const dynamic = "force-dynamic";

/** MKB Financial Group's public website (published content). */
export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  return siteMetadata("mkb", slugOf((await params).slug));
}
export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  return <SitePageView site="mkb" slug={slugOf((await params).slug)} />;
}
