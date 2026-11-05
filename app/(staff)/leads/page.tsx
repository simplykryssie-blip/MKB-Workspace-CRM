import type { Metadata } from "next";
import { LeadsPage } from "@/components/leads/LeadsPage";

export const metadata: Metadata = { title: "Leads" };

export default function Page() {
  return <LeadsPage />;
}
