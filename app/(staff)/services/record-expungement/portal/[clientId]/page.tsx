import type { Metadata } from "next";
import { ExpPortal } from "@/components/expunge/ExpPortal";
import { CLIENTS } from "@/lib/sample/clients";

export function generateStaticParams() {
  return CLIENTS.map((c) => ({ clientId: c.id }));
}

export const metadata: Metadata = { title: "Client portal — Expungement" };

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ExpPortal key={clientId} clientId={clientId} />;
}
