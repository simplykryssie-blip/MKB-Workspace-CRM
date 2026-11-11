"use client";

import { useEffect, useState } from "react";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { SAMPLE_FORMS } from "@/lib/sample/forms-seed";
import { BACKEND } from "@/lib/sync/remote";
import type { LeadForm } from "@/lib/forms/config";

/**
 * A published Form shown inside a website page. Answers go to the same public
 * endpoint as the form's own link, so they become Leads (rate-limited, spam trap,
 * never reads anything back). In the editor preview nothing is sent.
 */
export function SiteForm({ slug, preview, afterHref }: { slug: string; preview?: boolean; afterHref?: string }) {
  const sample = SAMPLE_FORMS.find((f) => f.slug === slug) ?? SAMPLE_FORMS[0];
  const [form, setForm] = useState<LeadForm | null | undefined>(BACKEND ? undefined : sample);
  useEffect(() => {
    if (!BACKEND || !slug) { if (BACKEND) setForm(null); return; }
    fetch(`/api/public/forms/${encodeURIComponent(slug)}`).then(async (r) => setForm(r.ok ? ((await r.json()) as { form: LeadForm }).form : null)).catch(() => setForm(null));
  }, [slug]);
  const submit = async (data: Record<string, string>, honeypot: string) => {
    if (!BACKEND || preview) return;
    const r = await fetch(`/api/public/forms/${encodeURIComponent(slug)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, honeypot, embed: true }) });
    if (!r.ok) return ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong. Please try again or call us.";
    // Funnels: go straight on to the next page.
    if (afterHref) window.location.assign(afterHref);
  };
  if (form === undefined) return <p style={{ color: "#777" }}>Loading…</p>;
  if (!form)
    return (
      <div style={{ background: "#fff", border: "1px solid #ddd", padding: 24 }}>
        <p style={{ margin: 0, color: "#555" }}>{preview ? `No published form with the link name “${slug}”. Publish it in Forms, or pick another form for this section.` : "This form isn't available right now. Please call or email us instead."}</p>
      </div>
    );
  return (
    <div style={{ color: "initial", fontFamily: "var(--font-sans, system-ui)" }}>
      <FormRenderer form={form} mode={preview ? "preview" : "live"} onSubmit={submit} note={preview || !BACKEND ? <p style={{ marginTop: 12, fontSize: 12.5, color: "#7a5b00" }}>Preview — nothing is sent from here.</p> : null} />
    </div>
  );
}
