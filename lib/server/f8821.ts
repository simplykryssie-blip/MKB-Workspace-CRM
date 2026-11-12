/**
 * IRS Form 8821 for tax clients. The official form is filled from the client
 * record and the designee settings; the full SSN/EIN is decrypted only to
 * write the IRS-ready PDF (reveal permission required, audited). The copy in
 * the client's Documents shows only the last four. Server-only.
 */
import { PDFDocument, StandardFonts } from "pdf-lib";
import { EMPTY_BUREAU, EMPTY_DESIGNEE, designeeReady, type Bureau, mattersFor, yearsFor, type Designee, type F8821, type F8821Status, type MatterRow } from "@/lib/irs/f8821";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, rateLimit, run, type AppEnv } from "./core";
import { decryptField, randomId } from "./crypto";
import { CLIENT_SQL, aad, canOpen, vaultKey, type ClientRow } from "./clients";
import { audit, hasSensitivePerm, requirePermission, requireStaff, type Actor } from "./identity";
import { F8821_B64 } from "./irs-forms/f8821";

/* ---------------------------------------------------------------- designee (Settings) */
async function storedDesignee(env: AppEnv): Promise<Designee> {
  const r = await one<{ data: string }>(env.DB, "SELECT data FROM service_settings WHERE key = 'designee'").catch(() => null);
  return { ...EMPTY_DESIGNEE, ...(r ? json<Partial<Designee>>(r.data, {}) : {}) };
}
/** The designee as Form 8821 uses it. */
export async function loadDesignee(env: AppEnv): Promise<Designee> {
  const d = await storedDesignee(env);
  // Anything left blank here comes from the service bureau details (CAF and PTIN are personal, so they never do).
  const b = await loadBureau(env);
  for (const k of ["name", "address", "city", "state", "zip", "phone", "fax"] as const) if (!d[k].trim() && b[k].trim()) d[k] = b[k];
  return d;
}

/* ---------------------------------------------------------------- service bureau (Settings) */
export async function loadBureau(env: AppEnv): Promise<Bureau> {
  const r = await one<{ data: string }>(env.DB, "SELECT data FROM service_settings WHERE key = 'bureau'").catch(() => null);
  return { ...EMPTY_BUREAU, ...(r ? json<Partial<Bureau>>(r.data, {}) : {}) };
}
export async function getBureau(env: AppEnv, a: Actor) {
  requirePermission(a, "tax", "view");
  requireStaff(a);
  return { bureau: await loadBureau(env) };
}
export async function saveBureau(env: AppEnv, a: Actor, b: { bureau?: Partial<Bureau> }) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const x = b.bureau ?? {};
  const s = (k: keyof Bureau, max: number) => String(x[k] ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
  const digits = (k: keyof Bureau, n: number, label: string) => { const v = s(k, 20).replace(/\D/g, ""); if (v && v.length !== n) throw badRequest(`${label} should be ${n} digits.`); return v; };
  const clean: Bureau = { name: s("name", 120), ein: digits("ein", 9, "EIN"), efin: digits("efin", 6, "EFIN"), etin: digits("etin", 5, "ETIN"), address: s("address", 160), city: s("city", 80), state: s("state", 2).toUpperCase(), zip: s("zip", 10), phone: s("phone", 20), fax: s("fax", 20), email: s("email", 120) };
  await run(env.DB, "INSERT INTO service_settings (key, data, updated_at, updated_by) VALUES ('bureau', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by", JSON.stringify(clean), now(), a.member.id);
  await audit(env.DB, a, { action: "Record update", resource: "Service bureau details", meta: "Service bureau details updated" });
  return { bureau: clean };
}
export async function getDesignee(env: AppEnv, a: Actor) {
  requirePermission(a, "tax", "view");
  // What's typed in Settings, the bureau details blank fields fall back to, and the result the form uses.
  const [designee, bureau, filled] = await Promise.all([storedDesignee(env), loadBureau(env), loadDesignee(env)]);
  return { designee, bureau, filled, ready: designeeReady(filled) };
}
export async function saveDesignee(env: AppEnv, a: Actor, b: { designee?: Partial<Designee> }) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  const d = b.designee ?? {};
  const s = (k: keyof Designee, max: number) => String(d[k] ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
  const clean: Designee = { name: s("name", 120), address: s("address", 160), city: s("city", 80), state: s("state", 2).toUpperCase(), zip: s("zip", 10), caf: s("caf", 20), ptin: s("ptin", 12).toUpperCase(), phone: s("phone", 30), fax: s("fax", 30) };
  if (clean.ptin && !/^P\d{8}$/.test(clean.ptin)) throw badRequest("A PTIN looks like P12345678.");
  if (clean.caf && !/^[0-9A-Z-]{6,20}$/i.test(clean.caf)) throw badRequest("Check the CAF number.");
  await run(env.DB, "INSERT INTO service_settings (key, data, updated_at, updated_by) VALUES ('designee', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by", JSON.stringify(clean), now(), a.member.id);
  await audit(env.DB, a, { action: "Record update", resource: "IRS designee (Form 8821)", meta: "Designee details updated" });
  return { designee: clean };
}

/* ---------------------------------------------------------------- records */
type Row = { id: string; client_id: string; status: F8821Status; years_from: number; years_to: number; matters: string; created_at: string; signed_at: string | null; signer_name: string | null; signer_title: string | null; sign_method: F8821["signMethod"] | null; id_check: string | null; copy_file_id: string | null; submitted_at: string | null; on_file_at: string | null; revoked_at: string | null; note: string | null; c_name: string; c_type: "individual" | "business" };
const SQL = "SELECT f.*, c.name AS c_name, c.type AS c_type FROM tax_8821 f JOIN clients c ON c.id = f.client_id";
const toForm = (r: Row): F8821 => ({
  id: r.id, clientId: r.client_id, clientName: r.c_name, clientType: r.c_type, status: r.status, yearsFrom: r.years_from, yearsTo: r.years_to, matters: json<MatterRow[]>(r.matters, []), createdAt: r.created_at,
  signedAt: r.signed_at ?? undefined, signerName: r.signer_name ?? undefined, signerTitle: r.signer_title ?? undefined, signMethod: r.sign_method ?? undefined, idCheck: r.id_check ?? undefined, copyFileId: r.copy_file_id ?? undefined,
  submittedAt: r.submitted_at ?? undefined, onFileAt: r.on_file_at ?? undefined, revokedAt: r.revoked_at ?? undefined, note: r.note ?? undefined,
});

async function clientRow(env: AppEnv, a: Actor, clientId: string) {
  const row = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, clientId);
  if (!row || !(await canOpen(env, a, row))) throw notFound("Client not found.");
  return row;
}
async function formRow(env: AppEnv, a: Actor, id: string) {
  const r = await one<Row>(env.DB, `${SQL} WHERE f.id = ?`, id);
  if (!r) throw notFound("Form 8821 not found.");
  await clientRow(env, a, r.client_id);
  return r;
}

/** Every tax client: their current 8821 (if any). Clients the person can't open are left out. */
export async function list8821(env: AppEnv, a: Actor) {
  requirePermission(a, "tax", "view");
  requireStaff(a);
  const [clients, forms] = await Promise.all([
    all<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id IN (SELECT client_id FROM client_services WHERE service = 'tax') OR c.id IN (SELECT client_id FROM tax_returns)`),
    all<Row>(env.DB, `${SQL} ORDER BY f.created_at DESC`),
  ]);
  const open = new Set<string>();
  for (const c of clients) if (await canOpen(env, a, c)) open.add(c.id);
  const visible = forms.filter((f) => open.has(f.client_id));
  const current = new Map<string, Row>();
  for (const f of visible) if (!current.has(f.client_id) && f.status !== "revoked") current.set(f.client_id, f);
  const missing = clients.filter((c) => open.has(c.id) && !current.has(c.id)).map((c) => ({ id: c.id, name: c.name, type: c.type }));
  return { forms: [...current.values()].map(toForm), missing, designeeReady: designeeReady(await loadDesignee(env)) };
}

async function create(env: AppEnv, a: Extract<Actor, { kind: "staff" }>, c: ClientRow) {
  const years = yearsFor();
  const ret = await one<{ form: string }>(env.DB, "SELECT form FROM tax_returns WHERE client_id = ? AND kind = 'business' ORDER BY tax_year DESC LIMIT 1", c.id);
  const matters = mattersFor(c.type, years, ret?.form, json<{ entityType?: string } | null>(c.business, null)?.entityType);
  const id = randomId("f8821");
  const t = now();
  await run(env.DB, "INSERT INTO tax_8821 (id, client_id, status, years_from, years_to, matters, created_at, created_by, updated_at) VALUES (?, ?, 'needs_signature', ?, ?, ?, ?, ?, ?)", id, c.id, years.from, years.to, JSON.stringify(matters), t, a.member.id, t);
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', ?, 'system', ?, ?)", randomId("x"), c.id, `Form 8821 prepared (tax years ${years.from}–${years.to}) — needs the client's signature`, a.member.id, t);
  return id;
}

/** Prepares an 8821 for one client, or for every tax client missing one ({ all: true }). */
export async function prepare8821(env: AppEnv, a: Actor, b: { clientId?: unknown; all?: unknown }) {
  requirePermission(a, "tax", "edit");
  requireStaff(a);
  const ids = b.all === true ? (await list8821(env, a)).missing.map((m) => m.id) : typeof b.clientId === "string" ? [b.clientId] : [];
  if (!ids.length) throw badRequest("No clients need a Form 8821.");
  const made: string[] = [];
  for (const cid of ids.slice(0, 200)) {
    const c = await clientRow(env, a, cid);
    const has = await one<{ id: string }>(env.DB, "SELECT id FROM tax_8821 WHERE client_id = ? AND status != 'revoked' LIMIT 1", cid);
    if (!has) made.push(await create(env, a, c));
  }
  await audit(env.DB, a, { action: "Record update", resource: "Form 8821", department: "tax", meta: `Prepared ${made.length} form${made.length === 1 ? "" : "s"}` });
  return { created: made.length };
}

/** Called when a tax return is created: make sure the client has an 8821 in progress. Never throws. */
export async function ensure8821(env: AppEnv, a: Actor, clientId: string) {
  try {
    if (a.kind !== "staff") return;
    const has = await one<{ id: string }>(env.DB, "SELECT id FROM tax_8821 WHERE client_id = ? AND status != 'revoked' LIMIT 1", clientId);
    if (has) return;
    const c = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, clientId);
    if (c) await create(env, a, c);
  } catch (e) {
    console.error("ensure8821", e instanceof Error ? e.message : e);
  }
}

/* ---------------------------------------------------------------- filling the official form */
const fmtTin = (d: string, kind: "individual" | "business") => (kind === "business" ? `${d.slice(0, 2)}-${d.slice(2)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`);
const usDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "America/Chicago" });

async function fill(env: AppEnv, f: Row, c: ClientRow, tin: string, d: Designee, opts: { flatten: boolean }) {
  const pdf = await PDFDocument.load(Uint8Array.from(atob(F8821_B64), (ch) => ch.charCodeAt(0)));
  const form = pdf.getForm();
  const P = "topmostSubform[0].Page1[0].";
  const text = (name: string, v: string) => { if (v) form.getTextField(P + name).setText(v); };
  const check = (name: string) => form.getCheckBox(P + name).check();
  const addr = json<{ line1?: string; city?: string; state?: string; zip?: string }>(c.address, {});
  text("f1_6[0]", [c.name, addr.line1, [addr.city, [addr.state, addr.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join("\n"));
  text("f1_7[0]", tin);
  text("f1_8[0]", c.phone && c.phone !== "—" ? c.phone : "");
  text("f1_10[0]", [d.name, d.address, `${d.city}, ${d.state} ${d.zip}`].join("\n"));
  check("c1_2[0]"); // send copies of notices to the designee
  text("f1_11[0]", d.caf);
  text("f1_12[0]", d.ptin);
  text("f1_13[0]", d.phone);
  text("f1_14[0]", d.fax);
  const rows = [["f1_20", "f1_21", "f1_22", "f1_23"], ["f1_24", "f1_25", "f1_26", "f1_27"], ["f1_28", "f1_29", "f1_30", "f1_31"]];
  json<MatterRow[]>(f.matters, []).slice(0, 3).forEach((m, i) => {
    const [a1, b1, c1, d1] = rows[i].map((x) => `Table_Line3[0].BodyRow${i + 1}[0].${x}[0]`);
    text(a1, m.type); text(b1, m.form); text(c1, m.years); text(d1, m.specific);
  });
  if (f.signer_name) {
    text("f1_32[0]", f.signer_name);
    text("f1_33[0]", f.signer_title ?? "");
    // Signature and date lines (no form fields on the official PDF).
    const page = pdf.getPage(0);
    const font = await pdf.embedFont(f.sign_method === "paper" ? StandardFonts.Helvetica : StandardFonts.HelveticaOblique);
    if (f.sign_method !== "paper") page.drawText(`/s/ ${f.signer_name}`, { x: 64, y: 138, size: 11, font });
    if (f.signed_at) page.drawText(usDate(f.signed_at), { x: 440, y: 138, size: 11, font });
  }
  if (opts.flatten) form.flatten();
  return pdf.save();
}

async function tinFor(env: AppEnv, c: ClientRow) {
  const field = c.type === "business" ? "ein" : "tax_id";
  const v = await one<{ ciphertext: string; iv: string; last4: string | null }>(env.DB, "SELECT ciphertext, iv, last4 FROM vault WHERE owner_type = 'client' AND owner_id = ? AND field = ?", c.id, field);
  if (!v) return null;
  const d = (await decryptField(vaultKey(env).key, v, aad(c.id, field))).replace(/\D/g, "");
  return { full: fmtTin(d, c.type), masked: c.type === "business" ? `••-•••${d.slice(-4)}` : `•••-••-${d.slice(-4)}` };
}

/** The IRS-ready PDF (full SSN/EIN). Needs the reveal permission; every download is audited. */
export async function download8821(env: AppEnv, a: Actor, id: string) {
  requirePermission(a, "tax", "view");
  requireStaff(a);
  const f = await formRow(env, a, id);
  const c = await clientRow(env, a, f.client_id);
  const perm = c.type === "business" ? "tax.ein" : "tax.revealSsn";
  if (!hasSensitivePerm(a, perm)) {
    await audit(env.DB, a, { action: "Sensitive reveal", resource: `Client ${c.id} — Form 8821`, meta: "Download denied: needs the reveal permission", success: false });
    throw forbidden(`The IRS-ready 8821 shows the full ${c.type === "business" ? "EIN" : "SSN"}, so it needs that reveal permission.`);
  }
  if (!(await rateLimit(env.DB, `f8821:${a.member.id}`, 60, 60))) throw new HttpError(429, "Too many downloads in the last hour.", "rate_limited");
  const d = await loadDesignee(env);
  if (!designeeReady(d)) throw badRequest("Add your designee details (name, address and CAF number) in Settings → IRS designee first.");
  const tin = await tinFor(env, c);
  if (!tin) throw badRequest(`This client has no ${c.type === "business" ? "EIN" : "SSN/ITIN"} on file. Add it on the client's profile first.`);
  const bytes = await fill(env, f, c, tin.full, d, { flatten: true });
  await audit(env.DB, a, { action: "Sensitive reveal", resource: `Client ${c.id} — Form 8821`, meta: f.signer_name ? "Downloaded signed IRS-ready form" : "Downloaded unsigned form for signature" });
  const name = `Form-8821-${c.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}${f.signer_name ? "-signed" : ""}.pdf`;
  return new Response(bytes as unknown as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}

/** Staff record a signature given in the office or on paper. Saves a last-4 copy to the client's Documents. */
export async function sign8821(env: AppEnv, a: Actor, id: string, b: { name?: unknown; title?: unknown; method?: unknown; idCheck?: unknown }) {
  requirePermission(a, "tax", "edit");
  requireStaff(a);
  const f = await formRow(env, a, id);
  if (f.status !== "needs_signature") throw badRequest("This form is already signed.");
  const c = await clientRow(env, a, f.client_id);
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 60) : "";
  const method = b.method === "paper" ? "paper" : "in_office";
  const idCheck = typeof b.idCheck === "string" ? b.idCheck.trim().slice(0, 120) : "";
  if (name.length < 2) throw badRequest("Enter the signer's full name.");
  if (c.type === "business" && !title) throw badRequest("Enter the signer's title (for example Owner, President or Managing member).");
  if (method === "in_office" && !idCheck) throw badRequest("Record how you checked the signer's ID (for example: Driver's license, checked in person).");
  const d = await loadDesignee(env);
  const tin = await tinFor(env, c);
  const t = now();
  const signed: Row = { ...f, signer_name: name, signer_title: title || null, sign_method: method, signed_at: t };
  // The copy kept in Documents shows only the last four digits.
  const copy = await fill(env, signed, c, tin?.masked ?? "On file", d, { flatten: true });
  const fileId = randomId("d");
  const key = `clients/${c.id}/${fileId}.pdf`;
  await env.FILES.put(key, copy, { httpMetadata: { contentType: "application/pdf" } });
  const fileName = `Form-8821-${c.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}-signed-copy.pdf`;
  const md = json<Record<string, unknown[]>>((await one<{ module_data: string | null }>(env.DB, "SELECT module_data FROM clients WHERE id = ?", c.id))?.module_data, {});
  md.documents = [{ id: fileId, name: `Form 8821 — signed ${usDate(t)} (tax years ${f.years_from}–${f.years_to})`, fileName, service: "tax", category: "IRS authorization", status: "received", sensitive: true, requestedAt: f.created_at, uploadedAt: t, sizeKb: Math.max(1, Math.round(copy.length / 1024)), uploadedBy: "staff", hasFile: true }, ...((md.documents as unknown[]) ?? [])];
  await env.DB.batch([
    env.DB.prepare("UPDATE tax_8821 SET status = 'signed', signed_at = ?, signer_name = ?, signer_title = ?, sign_method = ?, id_check = ?, recorded_by = ?, copy_file_id = ?, updated_at = ? WHERE id = ? AND status = 'needs_signature'").bind(t, name, title || null, method, idCheck || null, a.member.id, fileId, t, id),
    env.DB.prepare("INSERT INTO client_files (id, client_id, r2_key, name, content_type, size_bytes, sensitive, created_at, created_by) VALUES (?, ?, ?, ?, 'application/pdf', ?, 1, ?, ?)").bind(fileId, c.id, key, fileName, copy.length, t, a.member.id),
    env.DB.prepare("UPDATE clients SET module_data = ?, rev = rev + 1, updated_at = ? WHERE id = ?").bind(JSON.stringify(md), t, c.id),
    env.DB.prepare("INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'upload', ?, 'system', ?, ?)").bind(randomId("x"), c.id, `Form 8821 signed by ${name} (${method === "paper" ? "on paper" : "in the office"}) — copy saved to Documents`, a.member.id, t),
  ]);
  await audit(env.DB, a, { action: "Record update", resource: `Client ${c.id} — Form 8821`, department: "tax", meta: `Signature recorded (${method})` });
  return { form: toForm((await one<Row>(env.DB, `${SQL} WHERE f.id = ?`, id))!) };
}

/** Status steps after signing: submitted to the IRS, on file (CAF), or revoked. */
export async function mark8821(env: AppEnv, a: Actor, id: string, b: { to?: unknown; note?: unknown }) {
  requirePermission(a, "tax", "edit");
  requireStaff(a);
  const f = await formRow(env, a, id);
  const to = b.to as F8821Status;
  const t = now();
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : null;
  const ok: Partial<Record<F8821Status, F8821Status[]>> = { submitted: ["signed"], on_file: ["submitted", "signed"], revoked: ["needs_signature", "signed", "submitted", "on_file"] };
  if (!ok[to]?.includes(f.status)) throw badRequest("That step isn't available for this form.");
  if (to === "submitted") await run(env.DB, "UPDATE tax_8821 SET status = 'submitted', submitted_at = ?, submitted_by = ?, note = coalesce(?, note), updated_at = ? WHERE id = ?", t, a.member.id, note, t, id);
  else if (to === "on_file") await run(env.DB, "UPDATE tax_8821 SET status = 'on_file', on_file_at = ?, submitted_at = coalesce(submitted_at, ?), submitted_by = coalesce(submitted_by, ?), note = coalesce(?, note), updated_at = ? WHERE id = ?", t, t, a.member.id, note, t, id);
  else await run(env.DB, "UPDATE tax_8821 SET status = 'revoked', revoked_at = ?, note = coalesce(?, note), updated_at = ? WHERE id = ?", t, note, t, id);
  const label = to === "submitted" ? "submitted to the IRS" : to === "on_file" ? "confirmed on file with the IRS" : "revoked";
  await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', ?, 'system', ?, ?)", randomId("x"), f.client_id, `Form 8821 ${label}`, a.member.id, t);
  await audit(env.DB, a, { action: "Record update", resource: `Client ${f.client_id} — Form 8821`, department: "tax", meta: `Marked ${label}` });
  return { form: toForm((await one<Row>(env.DB, `${SQL} WHERE f.id = ?`, id))!) };
}
