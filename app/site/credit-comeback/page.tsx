import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CreditVaultFunnel } from "@/components/funnels/CreditVaultFunnel";

/**
 * Black Friday / Cyber Monday 2026: mkbfinancialgroup.com/credit-comeback (golden-ticket scratch-off).
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
  const title = "Scratch Your Golden Ticket | The Credit Comeback Vault | MKB Financial Group";
  const description = "Black Friday VIP: scratch your golden ticket and unlock The Credit Comeback Vault, a free 3-round do-it-yourself credit dispute system with a Letter Builder.";
  return {
    title: { absolute: title }, description,
    robots: { index: true, follow: true },
    alternates: { canonical: `${abs}/credit-comeback` },
    icons: { icon: [{ url: "/brand/mkb-seal.ico" }, { url: "/brand/mkb-seal-192.png", sizes: "192x192", type: "image/png" }], apple: "/brand/mkb-seal-apple-180.png" },
    openGraph: { title: "Scratch your Golden Ticket", description, url: `${abs}/credit-comeback`, siteName: "MKB Financial Group", type: "website" },
  };
}

export default async function Page() {
  const { own } = await origin();
  const off = own ? "/" : "/site";
  if (!BACKEND) redirect(off);
  const [{ getEnv }, { creditVaultPage }] = await Promise.all([import("@/lib/server/core"), import("@/lib/server/credit-vault")]);
  const page = await creditVaultPage(await getEnv()).catch(() => null);
  if (!page) redirect(off);
  return <CreditVaultFunnel form={page.form} tracking={page.tracking} home={own ? "/" : "/site"} privacyHref={page.privacy ? (own ? "/privacy" : "/site/privacy") : null} />;
}
