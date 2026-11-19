import type { Metadata } from "next";
import { LeadsPage } from "@/components/monarch/LeadsPage";

export const metadata: Metadata = { title: "Leads — Monarch" };

export default function Page() {
  return <LeadsPage />;
}
