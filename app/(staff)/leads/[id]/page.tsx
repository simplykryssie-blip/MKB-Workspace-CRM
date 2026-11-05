import type { Metadata } from "next";
import { LeadDetail } from "@/components/leads/LeadDetail";
import { LEADS } from "@/lib/sample/leads";

export function generateStaticParams() {
  return LEADS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: LEADS.find((l) => l.id === id)?.name ?? "Lead" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetail key={id} id={id} />;
}
