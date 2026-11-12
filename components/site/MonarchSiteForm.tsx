"use client";

import { useState } from "react";

/**
 * The contact form on Monarch Tax Suite's website. Answers create a new
 * "Interested" office in Monarch (rate-limited, with a hidden spam trap).
 * In the editor preview nothing is sent.
 */
export function MonarchSiteForm({ preview }: { preview?: boolean }) {
  const [f, setF] = useState({ name: "", office: "", email: "", phone: "", city: "", state: "", locations: "1", message: "", marketing: false, consent: false, website: "" });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) { setErr("Preview — nothing is sent from here."); return; }
    setState("sending"); setErr(null);
    try {
      const r = await fetch("/api/public/monarch-inquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      if (!r.ok) { setErr(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong. Please try again."); setState("idle"); return; }
      setState("done");
    } catch { setErr("Couldn't send — check your connection and try again."); setState("idle"); }
  };
  if (state === "done")
    return <div className="mform done"><h3>Thank you!</h3><p>We received your information and will reach out soon about the right package for your office.</p></div>;
  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label><span>{label}{props.required && " *"}</span><input value={f[k] as string} onChange={set(k)} {...props} /></label>
  );
  return (
    <form className="mform" onSubmit={submit} noValidate={false}>
      <div className="grid2">
        {field("name", "Your name", { required: true, autoComplete: "name" })}
        {field("office", "Office name", { autoComplete: "organization" })}
        {field("email", "Email", { required: true, type: "email", autoComplete: "email" })}
        {field("phone", "Phone", { required: true, type: "tel", autoComplete: "tel" })}
        {field("city", "City", { autoComplete: "address-level2" })}
        {field("state", "State", { maxLength: 2, autoComplete: "address-level1" })}
      </div>
      <label><span>How many locations?</span><select value={f.locations} onChange={set("locations")}><option>1</option><option>2–3</option><option>4–10</option><option>More than 10</option></select></label>
      <label><span>Anything else we should know?</span><textarea rows={4} value={f.message} onChange={set("message")} /></label>
      <label className="hp" aria-hidden="true"><span>Website</span><input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label>
      <label className="check"><input type="checkbox" checked={f.marketing} onChange={set("marketing")} /> <span>Yes — send me tips, deadline reminders and offers from Monarch Tax Suite by email and text. Message frequency varies; message and data rates may apply. Reply STOP to opt out of texts. (Optional)</span></label>
      <label className="check"><input type="checkbox" checked={f.consent} onChange={set("consent")} required /> <span>I agree that Monarch Tax Suite may contact me by phone, text or email about my request. Message and data rates may apply. I can opt out at any time.</span></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button type="submit" className="btn gold" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send"}</button>
    </form>
  );
}
