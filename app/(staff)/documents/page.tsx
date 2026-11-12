import type { Metadata } from "next";
import { DocumentsCenter } from "@/components/workspace/DocumentsCenter";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return <DocumentsCenter />;
}
