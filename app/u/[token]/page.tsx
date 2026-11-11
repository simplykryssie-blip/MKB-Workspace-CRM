import type { Metadata } from "next";
import { Unsubscribe } from "@/components/campaigns/Unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/** The unsubscribe link in every marketing email (MKB or Monarch). */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Unsubscribe token={token} />;
}
