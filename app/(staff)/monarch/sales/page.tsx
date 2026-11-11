import type { Metadata } from "next";
import { Suspense } from "react";
import { SalesPage } from "@/components/monarch/SalesPage";

export const metadata: Metadata = { title: "Sales & Payments — Monarch" };

export default function Page() {
  return <Suspense><SalesPage /></Suspense>;
}
