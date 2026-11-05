import type { Metadata } from "next";
import { ExpCenter } from "@/components/expunge/ExpCenter";

export const metadata: Metadata = { title: "Record Expungement" };

export default function Page() {
  return <ExpCenter />;
}
