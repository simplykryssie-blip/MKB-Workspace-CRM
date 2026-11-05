import type { Metadata } from "next";
import { ClientsList } from "@/components/crm/ClientsList";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return <ClientsList />;
}
