import type { Metadata } from "next";
import { WispGenerator } from "@/components/site/WispGenerator";
import { WidgetShell } from "@/components/site/WidgetShell";

export const metadata: Metadata = { title: "WISP Generator", robots: { index: false, follow: false } };

/** The WISP Generator inside a website page: <div data-mkb-widget="wisp" data-next="/wisp-next-steps"></div>. */
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next;
  return <WidgetShell><WispGenerator nextHref={next && /^\/(?!\/)/.test(next) ? next : "/wisp-next-steps"} /></WidgetShell>;
}
