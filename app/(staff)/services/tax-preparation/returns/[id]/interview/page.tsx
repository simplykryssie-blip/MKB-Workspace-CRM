import type { Metadata } from "next";
import { TaxInterview } from "@/components/tax/TaxInterview";
import { TAX_RETURNS } from "@/lib/sample/tax";

export function generateStaticParams() {
  return TAX_RETURNS.map((r) => ({ id: r.id }));
}

export const metadata: Metadata = { title: "Tax interview" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaxInterview key={id} id={id} />;
}
