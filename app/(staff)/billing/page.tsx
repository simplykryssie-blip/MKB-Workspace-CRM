import type { Metadata } from "next";
import { BillingPage } from "@/components/billing/BillingPage";

export const metadata: Metadata = { title: "Billing" };

export default function Page() {
  return <BillingPage />;
}
