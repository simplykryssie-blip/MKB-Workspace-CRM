import type { Metadata } from "next";
import { MonarchSiteForm } from "@/components/site/MonarchSiteForm";
import { WidgetShell } from "@/components/site/WidgetShell";

export const metadata: Metadata = { title: "Contact", robots: { index: false, follow: false } };

/** Monarch's contact form inside a website page: <div data-mkb-widget="monarch-contact"></div>. */
export default function Page() {
  return <WidgetShell><MonarchSiteForm /></WidgetShell>;
}
