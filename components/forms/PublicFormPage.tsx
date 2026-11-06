"use client";

import { useEffect, useState } from "react";
import { FormRenderer } from "./FormRenderer";
import { SAMPLE_FORMS } from "@/lib/sample/forms-seed";

/**
 * Public form page (direct link or website embed). Separate from the staff app:
 * visitors never see MKB's internal screens. In this preview, submissions here
 * aren't saved (there's no backend yet) — use the form's Test tab to see a
 * submission become a lead.
 */
export function PublicFormPage({ slug }: { slug: string }) {
  const form = SAMPLE_FORMS.find((f) => f.slug === slug && f.status === "published");
  const [embed, setEmbed] = useState(false);
  useEffect(() => setEmbed(new URLSearchParams(window.location.search).has("embed")), []);
  return (
    <main className={`min-h-screen bg-bg ${embed ? "p-0" : "px-4 py-8 sm:py-14"}`}>
      <div className="mx-auto max-w-2xl">
        {form ? (
          <FormRenderer
            form={form}
            mode="live"
            onSubmit={() => {}}
            note={<p className="mx-auto mt-4 max-w-md rounded-xl bg-warning-soft/60 px-3 py-2 text-[12.5px] text-warning-ink">Design preview — this response wasn&rsquo;t saved. Once the backend is connected, it goes straight to MKB&rsquo;s Leads.</p>}
          />
        ) : (
          <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-soft">
            <h1 className="text-[20px] font-bold text-ink">This form isn&rsquo;t available</h1>
            <p className="mt-2 text-[14px] text-muted">It may have been closed. Please contact MKB Financial Group directly.</p>
          </div>
        )}
        {!embed && <p className="mt-6 text-center text-[12px] text-muted">© MKB Financial Group · Fictional sample data in this preview</p>}
      </div>
    </main>
  );
}
