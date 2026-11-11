import type { Metadata } from "next";
import { SiteForm } from "@/components/site/SiteForm";
import { WidgetShell } from "@/components/site/WidgetShell";

export const metadata: Metadata = { title: "Form", robots: { index: false, follow: false } };

/** A published Form, shown inside a website page: <div data-mkb-widget="form" data-form="contact"></div>. */
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ after?: string }> }) {
  const { slug } = await params;
  const after = (await searchParams).after;
  return <WidgetShell><SiteForm slug={slug} afterHref={after && /^\/(?!\/)/.test(after) ? after : undefined} /></WidgetShell>;
}
