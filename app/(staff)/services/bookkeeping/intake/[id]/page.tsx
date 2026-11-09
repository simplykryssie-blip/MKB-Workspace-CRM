import type { Metadata } from "next";
import { BooksIntake } from "@/components/books/BooksIntake";

export const metadata: Metadata = { title: "Bookkeeping intake" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BooksIntake id={id} />;
}
