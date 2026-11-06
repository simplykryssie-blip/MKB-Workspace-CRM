import type { Metadata } from "next";
import { FormsCenter } from "@/components/forms/FormsCenter";

export const metadata: Metadata = { title: "Forms" };

export default function Page() {
  return <FormsCenter />;
}
