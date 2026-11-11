import type { Metadata } from "next";
import { PublicServiceIntake } from "@/components/intakes/PublicServiceIntake";

export const metadata: Metadata = { title: "Your MKB intake", robots: { index: false, follow: false } };

/** A client's private payroll, Business Solutions or Record Relief intake link (no sign-in). */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicServiceIntake token={token} />;
}
