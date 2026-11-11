import type { Metadata } from "next";
import { ResellersPage } from "@/components/monarch/ResellersPage";

export const metadata: Metadata = { title: "Resellers & Commissions — Monarch" };

export default function Page() {
  return <ResellersPage />;
}
