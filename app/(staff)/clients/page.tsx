import type { Metadata } from "next";
import { Download, UserPlus } from "lucide-react";
import { ClientsList } from "@/components/crm/ClientsList";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="One record per client, shared across every MKB service."
        actions={
          <>
            <Button icon={Download} title="Export requires the Export permission">
              Export
            </Button>
            <Button variant="primary" icon={UserPlus} href="/clients/new">
              New client
            </Button>
          </>
        }
      />
      <ClientsList />
    </>
  );
}
