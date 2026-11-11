import type { Metadata } from "next";
import { PackagesPage } from "@/components/monarch/PackagesPage";

export const metadata: Metadata = { title: "Packages — Monarch" };

export default function Page() {
  return <PackagesPage />;
}
