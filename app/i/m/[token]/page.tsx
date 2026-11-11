import type { Metadata } from "next";
import { PublicSetupLink } from "@/components/monarch/PublicSetupLink";

export const metadata: Metadata = { title: "Your Monarch setup", robots: { index: false, follow: false } };

/** An office's private Monarch setup link (no sign-in). The token in the address is the only key. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicSetupLink token={token} />;
}
