import type { Metadata } from "next";
import { BooksCenter } from "@/components/books/BooksCenter";

export const metadata: Metadata = { title: "Bookkeeping" };

export default function Page() {
  return <BooksCenter />;
}
