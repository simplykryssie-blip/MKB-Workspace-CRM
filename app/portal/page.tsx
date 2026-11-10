import type { Metadata } from "next";
import { PortalApp } from "@/components/portal/PortalApp";

export const metadata: Metadata = { title: "Your portal" };

export default function Page() {
  return <PortalApp />;
}
