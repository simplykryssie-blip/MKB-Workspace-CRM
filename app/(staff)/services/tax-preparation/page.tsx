import type { Metadata } from "next";
import { TaxCenter } from "@/components/tax/TaxCenter";

export const metadata: Metadata = { title: "Tax Preparation" };

export default function Page() {
  return <TaxCenter />;
}
