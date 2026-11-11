import type { Metadata } from "next";
import { SetupPage } from "@/components/monarch/SetupPage";

export const metadata: Metadata = { title: "Setup — Monarch" };

export default function Page() {
  return <SetupPage />;
}
