import type { Metadata } from "next";
import { ExpCenter } from "@/components/expunge/ExpCenter";

export const metadata: Metadata = { title: "Expungement Relief" };

export default function Page() {
  return <ExpCenter />;
}
