import type { Metadata } from "next";
import { EntityPage } from "@/components/biz/EntityPage";
import { BIZ_ENTITIES } from "@/lib/sample/biz-seed";

export function generateStaticParams() {
  return BIZ_ENTITIES.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: BIZ_ENTITIES.find((e) => e.id === id)?.legalName ?? "Business" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityPage key={id} id={id} />;
}
