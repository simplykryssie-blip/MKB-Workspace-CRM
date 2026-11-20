import type { Metadata } from "next";
import { CreditVaultKit } from "@/components/funnels/CreditVaultKit";

/** The private Credit Comeback Vault (link from the VIP email): the PDF and the Letter Builder. */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Your Credit Comeback Vault | MKB Financial Group" }, robots: { index: false, follow: false }, icons: { icon: [{ url: "/brand/mkb-seal.ico" }] } };

export default async function Page({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const k = (await searchParams).k ?? "";
  let ok = false;
  if (process.env.NEXT_PUBLIC_BACKEND === "1") {
    const [{ getEnv }, { kitValid }] = await Promise.all([import("@/lib/server/core"), import("@/lib/server/credit-vault")]);
    ok = await kitValid(await getEnv(), k).catch(() => false);
  }
  return <CreditVaultKit token={ok ? k : null} />;
}
