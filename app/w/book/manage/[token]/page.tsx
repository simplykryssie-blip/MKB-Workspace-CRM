import type { Metadata } from "next";
import { BookingShell } from "@/components/booking/BookingShell";
import { ManageBooking } from "@/components/booking/ManageBooking";

export const metadata: Metadata = { title: "Your appointment", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** The client's private link (from their confirmation email): reschedule or cancel. */
export default async function Page({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string; unpaid?: string; b?: string }> }) {
  const { token } = await params;
  const q = await searchParams;
  return <BookingShell brand={q.b === "monarch" ? "monarch" : "mkb"} embed={false}><ManageBooking token={token} paid={q.paid === "1"} unpaid={q.unpaid === "1"} /></BookingShell>;
}
