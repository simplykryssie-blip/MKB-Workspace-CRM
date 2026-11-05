import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientProfile } from "@/components/crm/ClientProfile";
import { CLIENTS, clientById } from "@/lib/sample/clients";

export function generateStaticParams() {
  return CLIENTS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: clientById(id)?.name ?? "Client" };
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = clientById(id);
  if (!client) notFound();
  return <ClientProfile client={client} />;
}
