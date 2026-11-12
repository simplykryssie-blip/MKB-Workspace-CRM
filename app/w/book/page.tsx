import type { Metadata } from "next";
import { BookingShell } from "@/components/booking/BookingShell";
import { BookingWidget } from "@/components/booking/BookingWidget";

export const metadata: Metadata = { title: "Book an appointment", robots: { index: false, follow: false } };

/**
 * The booking calendar: /w/book (MKB) or /w/book?brand=monarch, optionally
 * ?type=<appointment type>. Website pages embed it with
 * <div data-mkb-widget="booking" data-brand="mkb"></div>.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ brand?: string; type?: string; embed?: string }> }) {
  const q = await searchParams;
  const brand = q.brand === "monarch" ? "monarch" : "mkb";
  return <BookingShell brand={brand} embed={q.embed === "1"}><BookingWidget brand={brand} typeId={q.type?.slice(0, 80)} /></BookingShell>;
}
