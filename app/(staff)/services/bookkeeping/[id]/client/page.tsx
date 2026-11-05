import type { Metadata } from "next";
import { ClientTaskCenter } from "@/components/books/ClientTaskCenter";
import { BOOKS_WORKSPACES } from "@/lib/sample/books";

export function generateStaticParams() {
  return BOOKS_WORKSPACES.map((w) => ({ id: w.id }));
}

export const metadata: Metadata = { title: "Client task center (preview)" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientTaskCenter key={id} id={id} />;
}
