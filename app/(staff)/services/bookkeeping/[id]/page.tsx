import type { Metadata } from "next";
import { Workspace } from "@/components/books/Workspace";
import { BOOKS_WORKSPACES } from "@/lib/sample/books";

export function generateStaticParams() {
  return BOOKS_WORKSPACES.map((w) => ({ id: w.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: BOOKS_WORKSPACES.find((w) => w.id === id)?.businessName ?? "Bookkeeping" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Workspace key={id} id={id} />;
}
