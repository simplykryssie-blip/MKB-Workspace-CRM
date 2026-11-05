import type { Metadata } from "next";
import { RequestWorkspace } from "@/components/biz/RequestWorkspace";
import { BIZ_REQUESTS } from "@/lib/sample/biz-seed";

export function generateStaticParams() {
  return BIZ_REQUESTS.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = BIZ_REQUESTS.find((x) => x.id === id);
  return { title: r ? `${r.number} · ${r.serviceName}` : "Service request" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestWorkspace key={id} id={id} />;
}
