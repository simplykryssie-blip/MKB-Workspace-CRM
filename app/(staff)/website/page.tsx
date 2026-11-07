import type { Metadata } from "next";
import { WebsiteEditor } from "@/components/website/WebsiteEditor";

export const metadata: Metadata = { title: "Website" };

export default function Page() {
  return <WebsiteEditor />;
}
