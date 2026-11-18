import type { Metadata } from "next";
import { CalcSetupLink } from "@/components/monarch/CalcSetupLink";

export const metadata: Metadata = { title: "Your tax calculator setup", robots: { index: false, follow: false } };

/** A calculator buyer's private setup page (no sign-in). The token in the address is the only key. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CalcSetupLink token={token} />;
}
