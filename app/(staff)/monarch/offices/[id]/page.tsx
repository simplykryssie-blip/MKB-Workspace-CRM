import type { Metadata } from "next";
import { OfficeDetail } from "@/components/monarch/OfficeDetail";

export const metadata: Metadata = { title: "Office — Monarch" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OfficeDetail id={id} />;
}
