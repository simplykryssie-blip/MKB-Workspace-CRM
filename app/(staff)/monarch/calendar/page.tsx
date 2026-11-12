import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCenter } from "@/components/calendar/CalendarCenter";

export const metadata: Metadata = { title: "Calendar" };

/** One calendar for MKB and Monarch: appointments, time blocks and tasks (replaces Appointments and Tasks). */
export default function Page() {
  return <Suspense><CalendarCenter /></Suspense>;
}
