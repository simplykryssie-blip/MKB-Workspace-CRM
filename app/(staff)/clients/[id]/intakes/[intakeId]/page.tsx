import type { Metadata } from "next";
import { ManualServiceIntake } from "@/components/intakes/PublicServiceIntake";

export const metadata: Metadata = { title: "Enter intake manually" };

/** Staff: fill in a client's service intake manually (Payroll, Business Solutions, Record Relief). */
export default async function Page({ params }: { params: Promise<{ intakeId: string }> }) {
  return <ManualServiceIntake id={(await params).intakeId} />;
}
