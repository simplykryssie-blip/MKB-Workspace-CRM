import type { Metadata } from "next";
import { OfficesList } from "@/components/monarch/OfficesList";

export const metadata: Metadata = { title: "Offices — Monarch" };

export default function Page() {
  return <OfficesList />;
}
