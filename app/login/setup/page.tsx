import type { Metadata } from "next";
import { OwnerSetup } from "@/components/auth/OwnerSetup";

export const metadata: Metadata = { title: "First-time setup" };

export default function Page() {
  return <OwnerSetup />;
}
