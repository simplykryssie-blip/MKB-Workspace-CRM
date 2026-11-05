import type { Metadata } from "next";
import { ClientPortal } from "@/components/biz/ClientPortal";
import { CLIENTS } from "@/lib/sample/clients";

export function generateStaticParams() {
  return CLIENTS.map((c) => ({ clientId: c.id }));
}

export const metadata: Metadata = { title: "Client portal — Business services" };

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ClientPortal key={clientId} clientId={clientId} />;
}
