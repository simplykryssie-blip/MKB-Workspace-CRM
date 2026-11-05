import type { Metadata } from "next";
import { CasePage } from "@/components/expunge/CasePage";
import { EXP_CASES } from "@/lib/sample/exp-seed";

export function generateStaticParams() {
  return EXP_CASES.map((c) => ({ id: c.id }));
}

export const metadata: Metadata = { title: "Expungement case" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CasePage key={id} id={id} />;
}
