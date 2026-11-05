import type { Metadata } from "next";
import { NewLeadForm } from "@/components/leads/NewLeadForm";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "New lead" };

export default function Page() {
  return (
    <>
      <PageHeader title="New lead" subtitle="Capture a prospect. Email or phone is enough to start." crumbs={[{ label: "Leads", href: "/leads" }, { label: "New lead" }]} />
      <NewLeadForm />
    </>
  );
}
