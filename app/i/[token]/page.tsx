import type { Metadata } from "next";
import { PublicBooksIntake } from "@/components/books/PublicBooksIntake";

export const metadata: Metadata = { title: "Your bookkeeping intake", robots: { index: false, follow: false } };

/** A client's private intake link (no sign-in). The token in the address is the only key. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicBooksIntake token={token} />;
}
