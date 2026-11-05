import type { Metadata } from "next";
import { ReturnDetail } from "@/components/tax/ReturnDetail";
import { TAX_RETURNS } from "@/lib/sample/tax";

export function generateStaticParams() {
  return TAX_RETURNS.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = TAX_RETURNS.find((x) => x.id === id);
  return { title: r ? `TY ${r.taxYear} ${r.form}` : "Tax return" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReturnDetail key={id} id={id} />;
}
