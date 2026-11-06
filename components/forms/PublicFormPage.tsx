"use client";

import { useEffect, useState } from "react";
import { FormRenderer } from "./FormRenderer";
import { SAMPLE_FORMS } from "@/lib/sample/forms-seed";
import { BACKEND } from "@/lib/sync/remote";
import type { LeadForm } from "@/lib/forms/config";

/**
 * Public form page (direct link or website embed). Separate from the staff app:
 * visitors never see MKB's internal screens. With the backend on, the form comes
 * from the server and answers are sent to it (they become leads); otherwise the
 * sample forms are shown and nothing is saved.
 */
export function PublicFormPage({ slug }: { slug: string }) {
  const sample = SAMPLE_FORMS.find((f) => f.slug === slug && f.status === "published");
  const [form, setForm] = useState<LeadForm | null | undefined>(BACKEND ? undefined : sample ?? null);
  const [embed, setEmbed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setEmbed(new URLSearchParams(window.location.search).has("embed"));
    if (!BACKEND) return;
    fetch(`/api/public/forms/${encodeURIComponent(slug)}`).then(async (r) => setForm(r.ok ? ((await r.json()) as { form: LeadForm }).form : null)).catch(() => setForm(null));
  }, [slug]);
  const submit = async (data: Record<string, string>, honeypot: string) => {
    if (!BACKEND) return;
    const r = await fetch(`/api/public/forms/${encodeURIComponent(slug)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, honeypot, embed }) });
    if (!r.ok) return ((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong. Please try again or call us.";
  };
  return (
    <main className={`min-h-screen bg-bg ${embed ? "p-0" : "px-4 py-8 sm:py-14"}`}>
      <div className="mx-auto max-w-2xl">
        {form === undefined ? (
          <div className="grid min-h-[40vh] place-items-center text-[14px] text-muted" role="status">Loading…</div>
        ) : form ? (
          <FormRenderer
            form={form}
            mode="live"
            onSubmit={submit}
            note={err ? <p role="alert" className="mx-auto mt-4 max-w-md rounded-xl bg-danger-soft/60 px-3 py-2 text-[13px] text-danger-ink">{err}</p> : BACKEND ? null : <p className="mx-auto mt-4 max-w-md rounded-xl bg-warning-soft/60 px-3 py-2 text-[12.5px] text-warning-ink">Design preview — this response wasn&rsquo;t saved. Once the backend is connected, it goes straight to MKB&rsquo;s Leads.</p>}
          />
        ) : (
          <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-soft">
            <h1 className="text-[20px] font-bold text-ink">This form isn&rsquo;t available</h1>
            <p className="mt-2 text-[14px] text-muted">It may have been closed. Please contact MKB Financial Group directly.</p>
          </div>
        )}
        {!embed && <p className="mt-6 text-center text-[12px] text-muted">© MKB Financial Group{BACKEND ? "" : " · Fictional sample data in this preview"}</p>}
      </div>
    </main>
  );
}
