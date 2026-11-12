/**
 * WISP Generator (Monarch website funnel). Public: a tax practice answers the
 * questions, gets its plan as a PDF (shown for download and emailed), and is
 * saved as a Monarch lead — an "Interested" office with the PDF attached.
 * Rate-limited, with a hidden spam trap. Server-only.
 */
import { badRequest, HttpError, now, rateLimit, str, type AppEnv } from "./core";
import { recordConsent } from "./campaigns";
import { randomId } from "./crypto";
import { buildWispPdf } from "./intake-pdf";
import { notify } from "./notifications";
import { loadSettings } from "./monarch";
import { renderMonarch } from "./monarch-email";
import { sendEmail } from "./identity";
import { LOCATION_OPTIONS, PEOPLE_OPTIONS, readiness, SAFEGUARDS, WISP_DISCLAIMER, type Answer, type WispAnswers } from "@/lib/monarch/wisp";

const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

export async function generateWisp(env: AppEnv, ip: string, b: Record<string, unknown>) {
  if (str(b.website, 200)) return { ok: true };
  if (!(await rateLimit(env.DB, `monwisp:${ip}`, 5, 60))) throw new HttpError(429, "Too many requests. Please wait a few minutes and try again.", "rate_limited");
  const p = (b.practice ?? {}) as Record<string, unknown>;
  const practice = {
    businessName: str(p.businessName, 160), ownerName: str(p.ownerName, 120), email: str(p.email, 200).toLowerCase(), phone: str(p.phone, 40),
    city: str(p.city, 80), state: str(p.state, 2).toUpperCase(), qualifiedIndividual: str(p.qualifiedIndividual, 120),
    people: PEOPLE_OPTIONS.includes(String(p.people)) ? String(p.people) : "", locations: LOCATION_OPTIONS.includes(String(p.locations)) ? String(p.locations) : "", software: str(p.software, 120),
  };
  if (!practice.businessName) throw badRequest("Enter your business name.");
  if (practice.ownerName.length < 2) throw badRequest("Enter your name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(practice.email)) throw badRequest("Enter a valid email address — we'll send your plan there.");
  if (!b.consent) throw badRequest("Please check the box so we can send your plan and follow up.");
  const raw = (b.safeguards ?? {}) as Record<string, unknown>;
  const safeguards: Record<string, Answer> = {};
  for (const s of SAFEGUARDS) {
    const v = raw[s.key];
    if (v !== "yes" && v !== "no" && v !== "unsure") throw badRequest("Answer every question (choose “Not sure” if you don't know).");
    safeguards[s.key] = v;
  }
  const a: WispAnswers = { practice, safeguards };
  const r = readiness(a);
  const t = now();
  const areas = [...new Set(SAFEGUARDS.map((s) => s.area))].map((area) => ({ area, inPlace: SAFEGUARDS.filter((s) => s.area === area && safeguards[s.key] === "yes").map((s) => s.inPlace) }));
  const actions = r.gaps.map((s) => ({ area: s.area, text: s.action, unsure: safeguards[s.key] === "unsure" }));
  // Optional marketing opt-in (only once the plan is accepted): Monarch marketing email and texts.
  if (b.marketing === true) {
    await recordConsent(env, "monarch", "email", practice.email, "subscribed", "Monarch website: WISP generator", null);
    const ph = practice.phone.replace(/\D/g, "").slice(-10);
    if (ph.length === 10) await recordConsent(env, "monarch", "sms", ph, "subscribed", "Monarch website: WISP generator", null);
  }
  const pdf = await buildWispPdf({ practice, createdAt: t, areas, actions, score: r.score, disclaimer: WISP_DISCLAIMER });

  // Save the practice as a Monarch lead with the plan attached.
  const officeId = randomId("of");
  const fileId = randomId("mf");
  const key = `monarch/${officeId}/${fileId}.pdf`;
  const fileName = `WISP - ${practice.businessName}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
  await env.FILES.put(key, pdf, { httpMetadata: { contentType: "application/pdf" }, customMetadata: { uploadedBy: "office" } });
  const notes = [`From the WISP Generator (${new Date(t).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "America/Chicago" })}). Security readiness: ${r.score}% (${r.yes} of ${r.total} safeguards in place).`,
    practice.people && `People handling client data: ${practice.people}`, practice.locations && `Locations: ${practice.locations}`, practice.software && `Tax software: ${practice.software}`,
    r.gaps.length ? `Needs attention: ${r.gaps.map((g) => g.area + " — " + g.question.replace(/\?$/, "")).slice(0, 8).join("; ")}${r.gaps.length > 8 ? ` (+${r.gaps.length - 8} more)` : ""}` : ""].filter(Boolean).join("\n");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO mon_offices (id, name, contact_name, email, phone, city, state, stage, notes, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'interested', ?, ?, NULL, ?)").bind(officeId, practice.businessName, practice.ownerName, practice.email, practice.phone, practice.city, practice.state, notes, t, t),
    env.DB.prepare("INSERT INTO mon_files (id, office_id, item, r2_key, name, content_type, size_bytes, uploaded_by, created_at) VALUES (?, ?, 'other', ?, ?, 'application/pdf', ?, 'office', ?)").bind(fileId, officeId, key, fileName, pdf.length, t),
  ]);
  await notify(env, { module: "monarch" }, { kind: "lead", title: `New WISP lead: ${practice.businessName}`, body: `${practice.ownerName} built a WISP (${r.score}% ready, ${r.gaps.length} item${r.gaps.length === 1 ? "" : "s"} to address).`, href: `/monarch/offices/${officeId}` });

  // Email the plan.
  const s = await loadSettings(env);
  const first = practice.ownerName.split(" ")[0];
  const e = renderMonarch(env, s, {
    to: practice.email, template: "monarch_wisp", subject: `Your Written Information Security Plan — ${practice.businessName}`,
    heading: `Here's your WISP, ${first}.`,
    paragraphs: [`Your Written Information Security Plan for ${practice.businessName} is attached. Based on your answers, ${r.yes} of ${r.total} safeguards are in place (${r.score}%).`, r.gaps.length ? "The action plan in section 6 lists what still needs attention. Set a target date for each item and review the plan at least once a year." : "Keep reviewing your safeguards at least once a year.", "This plan is a starting template, not legal advice. Review it and adapt it to your practice."],
  });
  const mail = await sendEmail(env, { to: practice.email, template: "monarch_wisp", subject: e.subject, text: e.text, html: e.html, attachments: [{ filename: fileName, content: pdf }] });
  return { ok: true, score: r.score, yes: r.yes, total: r.total, gaps: r.gaps.map((g) => g.action), emailed: mail.sent, fileName, pdf: b64(pdf) };
}
