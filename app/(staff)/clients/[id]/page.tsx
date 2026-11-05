import type { Metadata } from "next";
import { ClientProfile } from "@/components/crm/ClientProfile";
import { CLIENTS, clientById } from "@/lib/sample/clients";

// Sample clients are pre-rendered; clients created during a preview session
// render on demand and are read from the in-browser sample store.
export function generateStaticParams() {
  return CLIENTS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: clientById(id)?.name ?? "Client" };
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientProfile id={id} />;
}
