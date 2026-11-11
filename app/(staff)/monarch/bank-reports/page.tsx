import type { Metadata } from "next";
import { BankReportsPage } from "@/components/monarch/BankReportsPage";

export const metadata: Metadata = { title: "Bank reports — Monarch" };

export default function Page() {
  return <BankReportsPage />;
}
