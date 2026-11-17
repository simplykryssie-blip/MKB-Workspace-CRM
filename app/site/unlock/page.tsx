import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MoneyVaultFunnel } from "@/components/funnels/MoneyVaultFunnel";

/**
 * The 2027 Money Vault campaign page: mkbfinancialgroup.com/unlock.
 * Switched on and off in Settings → Campaign funnels. When it's off (or its form isn't
 * published), visitors are sent to the Tax Preparation page instead.
 */
export const dynamic = "force-dynamic";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND === "1";

async function origin() {
  const h = await headers();
  const host = (h.get("host") ?? "www.mkbfinancialgroup.com").split(",")[0].trim();
  return { abs: `https://${host}`, own: h.get("x-mkb-site") === "1" };
}

export async function generateMetadata(): Promise<Metadata> {
  const { abs } = await origin();
  const title = "Unlock Your 2026 Tax Return | MKB Financial Group";
  const description = "Start your 2026 tax return with MKB Financial Group: a two-minute inquiry, then a private link to your tax interview. Virtual service in Louisiana and Texas.";
  return {
    title: { absolute: title }, description,
    robots: { index: true, follow: true },
    alternates: { canonical: `${abs}/unlock` },
    icons: { icon: [{ url: "/brand/mkb-seal.ico" }, { url: "/brand/mkb-seal-192.png", sizes: "192x192", type: "image/png" }], apple: "/brand/mkb-seal-apple-180.png" },
    openGraph: { title: "Unlock your 2026 tax return", description, url: `${abs}/unlock`, siteName: "MKB Financial Group", type: "website", images: [{ url: `${abs}/campaigns/money-vault-og.jpg`, width: 1200, height: 630, alt: "An open bank vault door" }] },
    twitter: { card: "summary_large_image", title: "Unlock your 2026 tax return", description, images: [`${abs}/campaigns/money-vault-og.jpg`] },
  };
}

export default async function Page() {
  const { own } = await origin();
  const off = own ? "/tax-preparation" : "/site/tax-preparation";
  if (!BACKEND) redirect(off);
  const [{ getEnv }, { moneyVaultPage }] = await Promise.all([import("@/lib/server/core"), import("@/lib/server/funnels")]);
  const page = await moneyVaultPage(await getEnv()).catch(() => null);
  if (!page) redirect(off);
  return <MoneyVaultFunnel form={page.form} tracking={page.tracking} campaignId={page.campaignId} taxYear={page.taxYear} home={own ? "/" : "/site"} privacyHref={page.privacy ? (own ? "/privacy" : "/site/privacy") : null} />;
}
