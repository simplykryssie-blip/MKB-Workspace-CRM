import type { Metadata } from "next";
import { PublicSign } from "@/components/signatures/PublicSign";

export const metadata: Metadata = { title: "Sign your document — MKB", robots: { index: false, follow: false } };

/** A client's private link to read and sign a document (no sign-in). */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicSign token={token} />;
}
