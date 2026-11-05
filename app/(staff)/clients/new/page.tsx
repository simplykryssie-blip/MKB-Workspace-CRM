import type { Metadata } from "next";
import { NewClientForm } from "@/components/crm/NewClientForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader title="New client" subtitle="Creates one central record. Existing clients are detected as you type." crumbs={[{ label: "Clients", href: "/clients" }, { label: "New client" }]} />
      <NewClientForm />
    </>
  );
}
