import type { Metadata } from "next";
import { WebsiteEditor } from "@/components/website/WebsiteEditor";

export const metadata: Metadata = { title: "Website — Monarch" };

/** Monarch Tax Suite's public website — same editor as MKB's, its own pages. */
export default function Page() {
  return <WebsiteEditor which="monarch" />;
}
