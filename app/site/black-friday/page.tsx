import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TaxPrizeFunnel } from "@/components/funnels/TaxPrizeFunnel";

/**
 * Black Friday / Cyber Monday 2026 Tax Prize: mkbfinancialgroup.com/black-friday (golden-ticket scratch-off).
 * Switched on and off in Settings → Campaign pages. Off: visitors go to the home page.
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
  const title = "Black Friday Tax Prize: Scratch & Win | MKB Financial Group";
  const description = "Every ticket wins $25, $50 or $75 off your 2026 tax return with MKB Financial Group. Scratch your golden ticket by Cyber Monday.";
  return {
    title: { absolute: title }, description,
    robots: { index: true, follow: true },
    alternates: { canonical: `${abs}/black-friday` },
    icons: { icon: [{ url: "/brand/mkb-seal.ico" }, { url: "/brand/mkb-seal-192.png", sizes: "192x192", type: "image/png" }], apple: "/brand/mkb-seal-apple-180.png" },
    openGraph: { title: "Scratch & win up to $75 off your taxes", description, url: `${abs}/black-friday`, siteName: "MKB Financial Group", type: "website" },
  };
}

export default async function Page() {
  const { own } = await origin();
  const off = own ? "/" : "/site";
  if (!BACKEND) redirect(off);
  const [{ getEnv }, { creditVaultPage }] = await Promise.all([import("@/lib/server/core"), import("@/lib/server/credit-vault")]);
  const page = await creditVaultPage(await getEnv()).catch(() => null);
  if (!page) redirect(off);
  return <TaxPrizeFunnel form={page.form} tracking={page.tracking} claimed={page.claimed} home={own ? "/" : "/site"} privacyHref={page.privacy ? (own ? "/privacy" : "/site/privacy") : null} />;
}
