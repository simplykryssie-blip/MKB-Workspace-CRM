/**
 * Forms — server side. Staff manage forms with Leads permissions ("view" to see,
 * "edit" to build, publish and test). Public submissions need no sign-in but are
 * rate-limited, checked against the published form, and can only create or add to
 * a lead — never read anything back. Server-only.
 */
import { FIELD_TYPES, MAP_TARGETS, MOST_RECENT_YEAR, TAX_RETURN_CHOICES, slugify, type AutoIntake, type FormField, type LeadForm, type Submission } from "@/lib/forms/config";
import { digits, extractLead, publishIssues, validateSubmission, visibleFields } from "@/lib/forms/logic";
import { all, badRequest, HttpError, json, notFound, now, one, rateLimit, run, str, addMinutes, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { notify } from "./notifications";
import { audit, loadMember, loadPolicy, requirePermission, type Actor } from "./identity";
import { sendLeadIntake } from "./prospects";

/** Keeps a valid "send the intake automatically" setting (anything else is dropped). */
function autoIntakeOf(v: unknown): { autoIntake?: AutoIntake } {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  if (!["tax", "books", "payroll", "biz", "relief"].includes(o.kind as string)) return {};
  const id = (x: unknown) => (typeof x === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(x) ? x : undefined);
  const only = id(o.onlyIfFieldId) && typeof o.onlyIfEquals === "string" ? { onlyIfFieldId: id(o.onlyIfFieldId), onlyIfEquals: o.onlyIfEquals.slice(0, 200) } : {};
  return { autoIntake: { kind: o.kind as AutoIntake["kind"], ...(o.kind === "tax" ? { returnFieldId: id(o.returnFieldId), yearFieldId: id(o.yearFieldId) } : {}), ...only } };
}

/**
 * A "start" form's automatic intake: emails the lead their private intake link
 * (tax interview or bookkeeping intake), sent as the lead's owner. When it can't
 * be sent (e.g. "Not sure" which return, an earlier tax year, or the lead already
 * submitted one), a note on the lead says so and staff send it from the lead.
 */
async function sendAutoIntake(env: AppEnv, f: LeadForm, leadId: string, data: Record<string, string>, ip: string) {
  const ai = f.routing.autoIntake;
  if (!ai) return;
  const db = env.DB;
  const note = (body: string) => db.prepare("INSERT INTO lead_notes (id, lead_id, author_id, body, at) VALUES (?, ?, (SELECT owner_id FROM leads WHERE id = ?), ?, ?)").bind(randomId("n"), leadId, leadId, body, now()).run();
  const label = ({ tax: "tax interview", books: "bookkeeping intake", payroll: "payroll intake", biz: "Business Solutions intake", relief: "Record Relief intake" } as const)[ai.kind];
  if (ai.onlyIfFieldId && data[ai.onlyIfFieldId] !== ai.onlyIfEquals) {
    const q = f.fields.find((x) => x.id === ai.onlyIfFieldId);
    await note(`The ${label} wasn't sent automatically (${q ? `“${q.label}” was answered “${data[ai.onlyIfFieldId] || "—"}”` : "a condition wasn't met"}). Follow up, then send it from this lead if it applies.`);
    return;
  }
  let extra: { taxYear?: number; form?: string } = {};
  if (ai.kind === "tax") {
    const form = TAX_RETURN_CHOICES[(ai.returnFieldId && data[ai.returnFieldId]) || ""];
    const recent = !ai.yearFieldId || data[ai.yearFieldId] === MOST_RECENT_YEAR;
    if (!form || !recent) { await note(`The tax interview wasn't sent automatically (${!form ? "they weren't sure which return they need" : "they asked about an earlier tax year"}). Follow up, then send it from this lead.`); return; }
    extra = { taxYear: new Date().getFullYear() - 1, form };
  }
  try {
    const lead = await one<{ owner_id: string }>(db, "SELECT owner_id FROM leads WHERE id = ?", leadId);
    const member = lead && (await loadMember(db, lead.owner_id));
    const user = member && (await one<{ id: string }>(db, "SELECT id FROM users WHERE member_id = ? AND kind = 'staff'", member.id));
    if (!member || !user) throw new Error("the lead's owner has no staff sign-in");
    const actor: Actor = { kind: "staff", userId: user.id, member, policy: await loadPolicy(db), ip };
    await sendLeadIntake(env, actor, leadId, { kind: ai.kind, ...extra });
  } catch (e) {
    await note(`The ${label} couldn't be sent automatically: ${e instanceof Error ? e.message : "unknown error"} Send it from this lead.`);
  }
}

type FormRow = { id: string; name: string; slug: string; title: string; intro: string | null; status: LeadForm["status"]; fields: string; services: string; routing: string; thank_you: string; created_at: string; updated_at: string; published_at: string | null };
const toForm = (r: FormRow): LeadForm => ({ id: r.id, name: r.name, slug: r.slug, title: r.title, intro: r.intro ?? undefined, status: r.status, fields: json(r.fields, []), services: json(r.services, []), routing: json(r.routing, { ownerId: "s-mk", stageId: "st-new", source: "Website", tags: [], followUpHours: 24 }), thankYou: r.thank_you, createdAt: r.created_at, updatedAt: r.updated_at, publishedAt: r.published_at ?? undefined });
type SubRow = { id: string; form_id: string; at: string; data: string; channel: Submission["channel"]; outcome: Submission["outcome"]; lead_id: string | null; client_id: string | null };
const toSub = (r: SubRow): Submission => ({ id: r.id, formId: r.form_id, at: r.at, data: json(r.data, {}), channel: r.channel, outcome: r.outcome, leadId: r.lead_id ?? undefined, clientId: r.client_id ?? undefined });

/* ---------------------------------------------------------------- staff */
export async function listForms(env: AppEnv, a: Actor) {
  requirePermission(a, "leads", "view");
  const [forms, subs] = await Promise.all([all<FormRow>(env.DB, "SELECT * FROM forms ORDER BY created_at DESC"), all<SubRow>(env.DB, "SELECT * FROM form_submissions ORDER BY at DESC LIMIT 2000")]);
  return { forms: forms.map(toForm), submissions: subs.map(toSub) };
}

function cleanFields(v: unknown): FormField[] {
  if (!Array.isArray(v) || v.length > 60) throw badRequest("A form can have up to 60 questions.");
  const types = FIELD_TYPES.map((t) => t.key);
  const maps = MAP_TARGETS.map((m) => m.key);
  const out = v.map((x: FormField): FormField => {
    if (!types.includes(x.type) || !maps.includes(x.map)) throw badRequest("Unknown question type.");
    return { id: str(x.id, 60), type: x.type, label: str(x.label, 1000), help: str(x.help, 300) || undefined, required: !!x.required, options: Array.isArray(x.options) ? x.options.map((o) => str(o, 200)).slice(0, 40) : undefined, map: x.map, showIf: x.showIf ? { fieldId: str(x.showIf.fieldId, 60), equals: str(x.showIf.equals, 200) } : undefined };
  });
  if (new Set(out.map((x) => x.id)).size !== out.length) throw badRequest("Duplicate question IDs.");
  return out;
}
async function cleanForm(env: AppEnv, f: LeadForm, id: string) {
  const name = str(f.name, 120);
  if (!name) throw badRequest("Give the form a name.");
  const slug = slugify(str(f.slug, 60) || name);
  if (await one(env.DB, "SELECT 1 FROM forms WHERE slug = ? AND id != ?", slug, id)) throw new HttpError(409, "Another form already uses that link name.", "duplicate");
  const r = f.routing ?? ({} as LeadForm["routing"]);
  if (r.ownerId && !(await one(env.DB, "SELECT 1 FROM members WHERE id = ? AND status = 'active'", r.ownerId))) throw badRequest("Assign new leads to an active team member.");
  if (r.stageId && !(await one(env.DB, "SELECT 1 FROM lead_stages WHERE id = ?", r.stageId))) throw badRequest("Unknown pipeline stage.");
  return {
    name, slug, title: str(f.title, 200) || name, intro: str(f.intro, 1000) || null,
    status: (["draft", "published", "archived"] as const).includes(f.status) ? f.status : "draft",
    fields: cleanFields(f.fields),
    services: (Array.isArray(f.services) ? f.services : []).filter((x) => ["tax", "books", "biz", "expunge"].includes(x)),
    routing: { ownerId: str(r.ownerId, 60) || "s-mk", stageId: str(r.stageId, 60) || "st-new", source: str(r.source, 60) || "Website", sourceDetail: str(r.sourceDetail, 120) || undefined, tags: (Array.isArray(r.tags) ? r.tags : []).map((t) => str(t, 40)).slice(0, 10), followUpHours: [4, 24, 48].includes(Number(r.followUpHours)) ? Number(r.followUpHours) : 24, ...autoIntakeOf(r.autoIntake) },
    thank_you: str(f.thankYou, 500) || "Thank you! We'll be in touch.",
  };
}

export async function createForm(env: AppEnv, a: Actor, f: LeadForm) {
  requirePermission(a, "leads", "edit");
  if (!/^form-[A-Za-z0-9_-]{3,40}$/.test(f.id ?? "")) throw badRequest("Invalid form ID.");
  if (await one(env.DB, "SELECT 1 FROM forms WHERE id = ?", f.id)) throw new HttpError(409, "That form already exists.", "exists");
  const c = await cleanForm(env, { ...f, status: "draft" }, f.id);
  const t = now();
  await run(env.DB, "INSERT INTO forms (id, name, slug, title, intro, status, fields, services, routing, thank_you, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)", f.id, c.name, c.slug, c.title, c.intro, JSON.stringify(c.fields), JSON.stringify(c.services), JSON.stringify(c.routing), c.thank_you, t, t);
  await audit(env.DB, a, { action: "Record update", resource: `Form ${c.name}`, meta: "Form created" });
  return toForm((await one<FormRow>(env.DB, "SELECT * FROM forms WHERE id = ?", f.id))!);
}

/** Saves a form. Publishing is refused while any question would collect sensitive information. */
export async function saveForm(env: AppEnv, a: Actor, id: string, f: LeadForm) {
  requirePermission(a, "leads", "edit");
  const cur = await one<FormRow>(env.DB, "SELECT * FROM forms WHERE id = ?", id);
  if (!cur) throw notFound("Form not found.");
  const c = await cleanForm(env, f, id);
  if (c.status === "published") {
    const issues = publishIssues({ fields: c.fields });
    if (issues.length) throw new HttpError(400, `Can't publish yet: ${issues[0]}`, "publish_blocked");
  }
  const t = now();
  await run(env.DB, "UPDATE forms SET name = ?, slug = ?, title = ?, intro = ?, status = ?, fields = ?, services = ?, routing = ?, thank_you = ?, updated_at = ?, published_at = COALESCE(published_at, CASE WHEN ? = 'published' THEN ? END) WHERE id = ?", c.name, c.slug, c.title, c.intro, c.status, JSON.stringify(c.fields), JSON.stringify(c.services), JSON.stringify(c.routing), c.thank_you, t, c.status, t, id);
  if (c.status !== cur.status) await audit(env.DB, a, { action: "Record update", resource: `Form ${c.name}`, meta: `Status: ${cur.status} → ${c.status}` });
  return toForm((await one<FormRow>(env.DB, "SELECT * FROM forms WHERE id = ?", id))!);
}

export async function deleteForm(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "leads", "edit");
  if (await one(env.DB, "SELECT 1 FROM form_submissions WHERE form_id = ?", id)) throw badRequest("Forms with submissions can't be deleted — archive it instead.");
  await run(env.DB, "DELETE FROM forms WHERE id = ?", id);
  await audit(env.DB, a, { action: "Record update", resource: `Form ${id}`, meta: "Form deleted" });
}

export async function markSpam(env: AppEnv, a: Actor, subId: string, spam: boolean) {
  requirePermission(a, "leads", "edit");
  const s = await one<SubRow>(env.DB, "SELECT * FROM form_submissions WHERE id = ?", subId);
  if (!s) throw notFound("Submission not found.");
  const outcome = spam ? "spam" : s.client_id ? "existing_client" : s.lead_id ? "new_lead" : "new_lead";
  await run(env.DB, "UPDATE form_submissions SET outcome = ? WHERE id = ?", outcome, subId);
}

/* ---------------------------------------------------------------- submissions */
/**
 * Turns a submission into a lead: matches an existing client or open lead by email
 * or phone (no duplicates); otherwise creates a lead routed by the form's settings.
 */
async function process(env: AppEnv, f: LeadForm, raw: Record<string, unknown>, channel: Submission["channel"], honeypot: string, ip: string) {
  // Keep only answers to this form's questions.
  const data: Record<string, string> = {};
  for (const fld of f.fields) if (typeof raw[fld.id] === "string") data[fld.id] = (raw[fld.id] as string).slice(0, 2000);
  for (const fld of visibleFields(f, data)) if (fld.type === "consent" && data[fld.id] && data[fld.id] !== "Yes") data[fld.id] = "";
  const db = env.DB;
  const subId = randomId("sub");
  const t = now();
  const save = (outcome: Submission["outcome"], leadId?: string, clientId?: string) => db.prepare("INSERT INTO form_submissions (id, form_id, at, data, channel, outcome, lead_id, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(subId, f.id, t, JSON.stringify(data), channel, outcome, leadId ?? null, clientId ?? null);
  if (honeypot.trim()) { await save("spam").run(); return { id: subId, outcome: "spam" as const }; }
  const errs = validateSubmission(f, data);
  if (Object.keys(errs).length) throw new HttpError(400, "Please check the highlighted answers.", "invalid");

  const L = extractLead(f, data);
  const phoneDigits = digits(L.phone);
  const norm = "replace(replace(replace(replace(replace(phone, '(', ''), ')', ''), '-', ''), ' ', ''), '+1', '')";
  const client = await one<{ id: string }>(db, `SELECT id FROM clients WHERE status NOT IN ('prospect', 'declined') AND ((? != '' AND email = ?) OR (length(?) = 10 AND ${norm} = ?)) LIMIT 1`, L.email, L.email, phoneDigits, phoneDigits);
  if (client) {
    // Their answers go on the client's profile as a note, so staff see them there.
    const author = (await one<{ id: string }>(db, "SELECT id FROM members WHERE id = ? AND status = 'active'", f.routing.ownerId))?.id ?? (await one<{ member_id: string }>(db, "SELECT member_id FROM record_assignments WHERE client_id = ? LIMIT 1", client.id))?.member_id ?? "system";
    const svc = f.services.length === 1 ? f.services[0] : null;
    await db.batch([
      save("existing_client", undefined, client.id),
      db.prepare("INSERT INTO client_activity (id, client_id, kind, text, actor, at) VALUES (?, ?, 'message', ?, 'client', ?)").bind(randomId("x"), client.id, `Submitted the “${f.name}” form — answers saved to Notes`, t),
      db.prepare("INSERT INTO client_notes (id, client_id, author_id, body, service, pinned, at) VALUES (?, ?, ?, ?, ?, 0, ?)").bind(randomId("n"), client.id, author, `Submitted the “${f.name}” form (${channel}):\n${L.summary}`, svc, t),
    ]);
    if (channel !== "Staff test") await notify(env, { module: "crm" }, { kind: "form", title: `A client submitted the “${f.name}” form`, href: `/clients/${client.id}#activity` });
    return { id: subId, outcome: "existing_client" as const, clientId: client.id };
  }
  const lead = await one<{ id: string; interests: string; owner_id: string; tags: string; type: string; name: string; contact_name: string | null; email: string; phone: string; business: string | null; address: string | null }>(db, `SELECT id, interests, owner_id, tags, type, name, contact_name, email, phone, business, address FROM leads WHERE status = 'open' AND ((? != '' AND email = ?) OR (length(?) = 10 AND ${norm} = ?)) LIMIT 1`, L.email, L.email, phoneDigits, phoneDigits);
  if (lead) {
    const interests = [...new Set([...json<string[]>(lead.interests, []), ...L.services])];
    // The form's tags (e.g. "Payroll Only") are added so the lead shows what was asked for this time.
    const tags = [...new Set([...json<string[]>(lead.tags, []), ...f.routing.tags])];
    // Fill in details the lead doesn't have yet — never overwrite what's already there.
    const filled: string[] = [];
    const phone = !digits(lead.phone ?? "") && L.phone ? (filled.push("phone"), L.phone) : lead.phone;
    const email = !lead.email && L.email ? (filled.push("email"), L.email) : lead.email;
    const toBiz = lead.type === "individual" && !lead.business && !!L.bizName;
    if (toBiz) filled.push("business name");
    const address = !lead.address && L.state ? (filled.push("state"), JSON.stringify({ line1: "", city: L.city, state: L.state, zip: L.zip })) : lead.address;
    await db.batch([
      save("existing_lead", lead.id),
      db.prepare("INSERT INTO lead_notes (id, lead_id, author_id, body, at) VALUES (?, ?, ?, ?, ?)").bind(randomId("n"), lead.id, lead.owner_id, `New “${f.name}” submission:\n${L.summary}`, t),
      db.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, at) VALUES (?, ?, 'lead', ?, 'client', ?)").bind(randomId("x"), lead.id, `Submitted the “${f.name}” form again`, t),
      db.prepare("UPDATE leads SET interests = ?, tags = ?, phone = ?, email = ?, address = ?, type = ?, name = ?, contact_name = ?, business = ?, rev = rev + 1, last_activity_at = ? WHERE id = ?").bind(
        JSON.stringify(interests), JSON.stringify(tags), phone, email, address,
        toBiz ? "business" : lead.type, toBiz ? L.bizName! : lead.name, toBiz ? lead.contact_name || lead.name : lead.contact_name,
        toBiz ? JSON.stringify({ entityType: L.entityType || "LLC", industry: "" }) : lead.business, t, lead.id),
      ...(filled.length ? [db.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, at) VALUES (?, ?, 'lead', ?, 'system', ?)").bind(randomId("x"), lead.id, `Added from the “${f.name}” form: ${filled.join(", ")}`, t)] : []),
    ]);
    if (channel !== "Staff test") await notify(env, { module: "leads" }, { kind: "form", title: `An open lead submitted the “${f.name}” form again`, href: `/leads/${lead.id}` });
    if (channel !== "Staff test") await sendAutoIntake(env, f, lead.id, data, ip);
    return { id: subId, outcome: "existing_lead" as const, leadId: lead.id };
  }
  // New lead, routed by the form's settings (falling back safely if the owner or stage changed).
  const owner = (await one<{ id: string }>(db, "SELECT id FROM members WHERE id = ? AND status = 'active'", f.routing.ownerId)) ?? (await one<{ id: string }>(db, "SELECT m.id FROM members m JOIN roles r ON r.id = m.role_id WHERE r.is_owner = 1 AND m.status = 'active' LIMIT 1"));
  const stage = (await one<{ id: string }>(db, "SELECT id FROM lead_stages WHERE id = ?", f.routing.stageId)) ?? (await one<{ id: string }>(db, "SELECT id FROM lead_stages ORDER BY position LIMIT 1"));
  if (!owner || !stage) throw new HttpError(503, "Forms aren't set up to receive leads yet.");
  const leadId = `L-${randomId("w").slice(2)}`;
  await db.batch([
    db.prepare("INSERT INTO leads (id, type, name, contact_name, email, phone, address, business, source, source_detail, interests, est_value, owner_id, stage_id, status, priority, tags, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'open', 'medium', ?, ?, ?)")
      .bind(leadId, L.bizName ? "business" : "individual", L.bizName || L.name || "Website visitor", L.bizName ? L.name : null, L.email, L.phone, L.state ? JSON.stringify({ line1: "", city: L.city, state: L.state, zip: L.zip }) : null, L.bizName ? JSON.stringify({ entityType: L.entityType || "LLC", industry: "" }) : null, f.routing.source, f.routing.sourceDetail ?? f.name, JSON.stringify(L.services), owner.id, stage.id, JSON.stringify([...f.routing.tags, "Web form"]), t, t),
    db.prepare("INSERT INTO lead_notes (id, lead_id, author_id, body, at) VALUES (?, ?, ?, ?, ?)").bind(randomId("n"), leadId, owner.id, `Submitted the “${f.name}” form (${channel}).\n${L.summary}`, t),
    db.prepare("INSERT INTO lead_reminders (id, lead_id, at, note, done, owner_id) VALUES (?, ?, ?, ?, 0, ?)").bind(randomId("r"), leadId, addMinutes(t, f.routing.followUpHours * 60), `Respond to “${f.name}” submission`, owner.id),
    db.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, at) VALUES (?, ?, 'lead', ?, 'system', ?)").bind(randomId("x"), leadId, `Lead created from ${f.routing.source}${f.routing.sourceDetail ? ` (${f.routing.sourceDetail})` : ""}`, t),
    save("new_lead", leadId),
  ]);
  await audit(db, { kind: "anonymous", ip }, { action: "Record update", resource: `Lead ${leadId}`, meta: `Created from the “${f.name}” form (${channel})` });
  if (channel !== "Staff test") await notify(env, { module: "leads" }, { kind: "lead", title: `New lead: ${(L.bizName || L.name || "Website visitor").slice(0, 80)}`, body: `From the “${f.name}” form`, href: `/leads/${leadId}` });
  if (channel !== "Staff test") await sendAutoIntake(env, f, leadId, data, ip);
  return { id: subId, outcome: "new_lead" as const, leadId };
}

/** Staff test from the builder (works for drafts too). */
export async function testSubmit(env: AppEnv, a: Actor, id: string, b: { data?: Record<string, unknown>; honeypot?: string }) {
  requirePermission(a, "leads", "edit");
  const row = await one<FormRow>(env.DB, "SELECT * FROM forms WHERE id = ?", id);
  if (!row) throw notFound("Form not found.");
  return process(env, toForm(row), b.data ?? {}, "Staff test", str(b.honeypot, 200), a.ip);
}

/* ---------------------------------------------------------------- public */
const publicView = (f: LeadForm) => ({ id: f.id, slug: f.slug, title: f.title, intro: f.intro, fields: f.fields, thankYou: f.thankYou, status: f.status, name: f.name, services: [], routing: { ownerId: "", stageId: "", source: "", tags: [], followUpHours: 24 }, createdAt: "", updatedAt: "" });

export async function publicForm(env: AppEnv, slug: string) {
  const row = await one<FormRow>(env.DB, "SELECT * FROM forms WHERE slug = ? AND status = 'published'", slug);
  if (!row) throw notFound("This form isn't available.");
  // Only what a visitor needs — never routing, owners or internal settings.
  return publicView(toForm(row));
}

export async function publicSubmit(env: AppEnv, req: Request, slug: string, b: { data?: Record<string, unknown>; honeypot?: string; embed?: boolean }, ip: string) {
  if (!(await rateLimit(env.DB, `form-ip:${ip}`, 10, 10))) throw new HttpError(429, "Too many submissions. Please try again in a few minutes.", "rate_limited");
  const row = await one<FormRow>(env.DB, "SELECT * FROM forms WHERE slug = ? AND status = 'published'", slug);
  if (!row) throw notFound("This form isn't available.");
  await process(env, toForm(row), b.data ?? {}, b.embed ? "Website embed" : "Direct link", str(b.honeypot, 200), ip);
  // The visitor never learns whether they matched an existing record.
  return { ok: true };
}
