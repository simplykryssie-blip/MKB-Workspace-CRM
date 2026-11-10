import type { Metadata } from "next";
import { PublicTaxInterview } from "@/components/tax/PublicTaxInterview";

export const metadata: Metadata = { title: "Your tax interview", robots: { index: false, follow: false } };

/** A client's (or lead's) private tax interview link (no sign-in). */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicTaxInterview token={token} />;
}
