import type { Metadata } from "next";
import { CustomersPage } from "@/components/monarch/CustomersPage";

export const metadata: Metadata = { title: "Customers — Monarch" };

export default function Page() {
  return <CustomersPage />;
}
