import type { Metadata } from "next";
import { MatterPage } from "@/components/expunge/MatterPage";
import { EXP_MATTERS } from "@/lib/sample/exp-seed";

export function generateStaticParams() {
  return EXP_MATTERS.map((m) => ({ id: m.id }));
}

// No client names in page titles (they can appear in browser history).
export const metadata: Metadata = { title: "Expungement matter" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatterPage key={id} id={id} />;
}
