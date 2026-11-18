import type { Metadata } from "next";
import { DownloadLink } from "@/components/monarch/DownloadLink";

export const metadata: Metadata = { title: "Your download", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DownloadLink token={token} />;
}
