import type { Metadata } from "next";
import { MonarchHome } from "@/components/monarch/MonarchHome";

export const metadata: Metadata = { title: "Onboarding — Monarch" };

export default function Page() {
  return <MonarchHome />;
}
