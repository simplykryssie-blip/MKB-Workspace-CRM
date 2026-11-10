import type { Metadata } from "next";
import { PublicProposal } from "@/components/books/PublicProposal";

export const metadata: Metadata = { title: "Your bookkeeping proposal", robots: { index: false, follow: false } };

/** A client's private proposal link (no sign-in): review the price and sign the engagement letter. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicProposal token={token} />;
}
