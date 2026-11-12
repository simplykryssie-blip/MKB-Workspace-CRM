/**
 * Monarch Tax Suite — the service bureau workspace (staff only).
 * Offices, their onboarding checklist, setup (packages, software, banks,
 * resellers) and settings. Every call checks the "monarch" permission.
 * Server-only.
 */
import { all, badRequest, HttpError, json, notFound, now, one, run, str, type AppEnv } from "./core";
import { recordConsent } from "./campaigns";
import { randomId } from "./crypto";
import { audit, requirePermission, type Actor } from "./identity";
import {
  checklistFor, DEFAULT_SETTINGS, isDone, itemState, stageIndex,
  type Bank, type BankStatus, type BankUpload, type Commission, type ItemState, type Location, type MonarchData, type MonarchSettings, type Office, type OfficeFile, type Package, type Preparer, type Reseller, type Sale, type Software, type Stage, type UnmatchedRow,
} from "@/lib/monarch/types";
import type { ActionKey } from "@/lib/team/config";

export const need = (a: Actor, action: ActionKey = "view") => requirePermission(a, "monarch", action);
export const staffId = (a: Actor) => (a.kind === "staff" ? a.member.id : "system");
export const note = (a: Actor, resource: string, meta: string, env: AppEnv) => audit(env.DB, a, { action: "Record update", resource: `Monarch — ${resource}`, meta });

/* ---------------------------------------------------------------- rows */
export type OfficeRow = {
  id: string; name: string; contact_name: string; email: string; phone: string; city: string; state: string; stage: Stage;
  package_id: string | null; software_id: string | null; bank_id: string | null; reseller_id: string | null; software_username: string;
  renews_on: string | null; extra_seats: number; extra_locations: number; notes: string; checklist: string; locations: string; preparers: string;
  agreement: string | null; link_hash: string | null; link_sent_at: string | null; link_last_used: string | null; link_expires_at: string | null; link_off_at: string | null;
  created_at: string; created_by: string | null; updated_at: string; rev: number;
};
type PackageRow = { id: string; name: string; kind: Package["kind"]; price_cents: number; billing: Package["billing"]; locations: number; seats: number; ask_ptins: number; features: string; active: number };
type SoftwareRow = { id: string; name: string; sb_fee_cents: number; download_url: string; welcome_subject: string; welcome_body: string; active: number };
type BankRow = { id: string; name: string; addon_fee_cents: number; application_url: string; layouts: string; active: number };
type ResellerRow = { id: string; name: string; contact: string; email: string; phone: string; rate_bp: number; notes: string; active: number };
type FileRow = { id: string; office_id: string; item: string; name: string; size_bytes: number; uploaded_by: string; created_at: string };

export const toPackage = (r: PackageRow): Package => ({ id: r.id, name: r.name, kind: r.kind, priceCents: r.price_cents, billing: r.billing, locations: r.locations, seats: r.seats, askPtins: !!r.ask_ptins, features: json(r.features, []), active: !!r.active });
export const toSoftware = (r: SoftwareRow): Software => ({ id: r.id, name: r.name, sbFeeCents: r.sb_fee_cents, downloadUrl: r.download_url, welcomeSubject: r.welcome_subject, welcomeBody: r.welcome_body, active: !!r.active });
export const toBank = (r: BankRow): Bank => ({ id: r.id, name: r.name, addonFeeCents: r.addon_fee_cents, applicationUrl: r.application_url, layouts: json(r.layouts, {}), active: !!r.active });
export const toReseller = (r: ResellerRow): Reseller => ({ id: r.id, name: r.name, contact: r.contact, email: r.email, phone: r.phone, rateBp: r.rate_bp, notes: r.notes, active: !!r.active });

export function linkState(r: Pick<OfficeRow, "link_hash" | "link_off_at" | "link_expires_at">, t = now()): Office["link"]["state"] {
  if (!r.link_hash) return r.link_off_at ? "off" : "none";
  if (r.link_off_at) return "off";
  return r.link_expires_at && r.link_expires_at <= t ? "expired" : "on";
}

export function toOffice(r: OfficeRow, files: FileRow[] = [], bank: BankStatus = {}): Office {
  const ag = json<{ name: string; at: string; fileId: string } | null>(r.agreement, null);
  return {
    id: r.id, name: r.name, contactName: r.contact_name, email: r.email, phone: r.phone, city: r.city, state: r.state, stage: r.stage,
    packageId: r.package_id ?? undefined, softwareId: r.software_id ?? undefined, bankId: r.bank_id ?? undefined, resellerId: r.reseller_id ?? undefined,
    softwareUsername: r.software_username, renewsOn: r.renews_on ?? undefined, extraSeats: r.extra_seats, extraLocations: r.extra_locations, notes: r.notes,
    checklist: json(r.checklist, {}), locations: json(r.locations, []), preparers: json(r.preparers, []), agreement: ag ?? undefined,
    link: { state: linkState(r), sentAt: r.link_sent_at ?? undefined, lastUsed: r.link_last_used ?? undefined, expiresAt: r.link_expires_at ?? undefined },
    files: files.filter((f) => f.office_id === r.id).map((f): OfficeFile => ({ id: f.id, item: f.item, name: f.name, sizeKb: Math.max(1, Math.round(f.size_bytes / 1024)), by: f.uploaded_by === "office" ? "office" : "staff", at: f.created_at })),
    bank, createdAt: r.created_at, updatedAt: r.updated_at, rev: r.rev,
  };
}

/* ---------------------------------------------------------------- settings */
export async function loadSettings(env: AppEnv): Promise<MonarchSettings> {
  const rows = await all<{ key: string; value: string }>(env.DB, "SELECT key, value FROM mon_settings");
  const s: MonarchSettings = { ...DEFAULT_SETTINGS, agreement: { ...DEFAULT_SETTINGS.agreement } };
  for (const r of rows) {
    if (r.key === "linkDays") s.linkDays = Number(r.value) || DEFAULT_SETTINGS.linkDays;
    if (r.key === "closeOnActive") s.closeOnActive = r.value === "1";
    if (r.key === "phone") s.phone = r.value;
    if (r.key === "email") s.email = r.value;
    if (r.key === "agreement") s.agreement = json(r.value, s.agreement);
  }
  return s;
}
const putSetting = (env: AppEnv, key: string, value: string, by: string) =>
  env.DB.prepare("INSERT INTO mon_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by").bind(key, value, now(), by);

export async function saveSettings(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  need(a, "settings");
  const cur = await loadSettings(env);
  const by = staffId(a);
  const st = [];
  if (b.linkDays !== undefined) { const d = Math.round(Number(b.linkDays)); if (!(d >= 1 && d <= 365)) throw badRequest("Days must be between 1 and 365."); st.push(putSetting(env, "linkDays", String(d), by)); }
  if (b.closeOnActive !== undefined) st.push(putSetting(env, "closeOnActive", b.closeOnActive ? "1" : "0", by));
  if (b.phone !== undefined) st.push(putSetting(env, "phone", str(b.phone, 40), by));
  if (b.email !== undefined) { const e = str(b.email, 200); if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw badRequest("That email address doesn't look right."); st.push(putSetting(env, "email", e, by)); }
  if (b.agreement !== undefined) {
    const text = typeof b.agreement === "string" ? b.agreement.replace(/\r/g, "").trim().slice(0, 30_000) : "";
    if (text.length < 40) throw badRequest("The agreement is too short.");
    if (text !== cur.agreement.text) st.push(putSetting(env, "agreement", JSON.stringify({ text, version: cur.agreement.version + 1 }), by));
  }
  if (st.length) await env.DB.batch(st);
  await note(a, "Setup", "Settings changed", env);
  return { settings: await loadSettings(env) };
}

/** EFINs matched by hand to an office (from bank report rows with no office). */
export async function efinMap(env: AppEnv): Promise<Record<string, string>> {
  const r = await one<{ value: string }>(env.DB, "SELECT value FROM mon_settings WHERE key = 'efinMap'");
  return json(r?.value, {});
}
export const normEfin = (s: unknown) => String(s ?? "").replace(/\D/g, "").slice(0, 6);
export const officeEfins = (o: { locations: Location[] }) => o.locations.map((l) => normEfin(l.efin)).filter((e) => e.length === 6);

/* ---------------------------------------------------------------- load everything */
export async function loadAll(env: AppEnv, a: Actor): Promise<MonarchData> {
  need(a);
  const [settings, pk, sw, bk, rs, of, fl, sl, cm, up] = await Promise.all([
    loadSettings(env),
    all<PackageRow>(env.DB, "SELECT * FROM mon_packages ORDER BY active DESC, price_cents DESC, name"),
    all<SoftwareRow>(env.DB, "SELECT * FROM mon_software ORDER BY active DESC, name"),
    all<BankRow>(env.DB, "SELECT * FROM mon_banks ORDER BY active DESC, name"),
    all<ResellerRow>(env.DB, "SELECT * FROM mon_resellers ORDER BY active DESC, name"),
    all<OfficeRow>(env.DB, "SELECT * FROM mon_offices ORDER BY updated_at DESC"),
    all<FileRow>(env.DB, "SELECT id, office_id, item, name, size_bytes, uploaded_by, created_at FROM mon_files WHERE deleted_at IS NULL ORDER BY created_at"),
    all<SaleRowLite>(env.DB, "SELECT * FROM mon_sales ORDER BY created_at DESC"),
    all<CommissionRow>(env.DB, "SELECT * FROM mon_commissions ORDER BY created_at DESC"),
    all<UploadRow>(env.DB, "SELECT * FROM mon_bank_uploads ORDER BY created_at DESC LIMIT 50"),
  ]);
  const { byOffice, unmatched } = await bankSummary(env, up);
  return {
    settings,
    packages: pk.map(toPackage), software: sw.map(toSoftware), banks: bk.map(toBank), resellers: rs.map(toReseller),
    offices: of.map((r) => toOffice(r, fl, byOffice[r.id])),
    sales: sl.map(toSale), commissions: cm.map(toCommission),
    uploads: up.map((u): BankUpload => ({ id: u.id, bankId: u.bank_id, reportType: u.report_type, fileName: u.file_name, rows: u.rows, matched: u.matched, createdAt: u.created_at })),
    unmatched,
    stripe: !!env.STRIPE_SECRET_KEY,
  };
}

/* sales & commissions rows (written in monarch-sales.ts) */
export type SaleRowLite = { id: string; office_id: string; package_id: string | null; description: string; qty: number; unit_cents: number; amount_cents: number; status: Sale["status"]; method: string | null; reference: string | null; paid_at: string | null; refunded_at: string | null; pay_token_hash: string | null; link_sent_at: string | null; reseller_id: string | null; created_at: string; created_by: string | null; updated_at: string };
export type CommissionRow = { id: string; reseller_id: string; sale_id: string; rate_bp: number; amount_cents: number; status: Commission["status"]; paid_at: string | null; paid_by: string | null; created_at: string };
export type UploadRow = { id: string; bank_id: string; report_type: "enrollment" | "funded"; file_name: string; rows: number; matched: number; created_at: string; created_by: string | null };
export const toSale = (r: SaleRowLite): Sale => ({ id: r.id, officeId: r.office_id, packageId: r.package_id ?? undefined, description: r.description, qty: r.qty, unitCents: r.unit_cents, amountCents: r.amount_cents, status: r.status, method: r.method ?? undefined, paidAt: r.paid_at ?? undefined, refundedAt: r.refunded_at ?? undefined, linkSentAt: r.link_sent_at ?? undefined, resellerId: r.reseller_id ?? undefined, createdAt: r.created_at });
export const toCommission = (r: CommissionRow): Commission => ({ id: r.id, resellerId: r.reseller_id, saleId: r.sale_id, rateBp: r.rate_bp, amountCents: r.amount_cents, status: r.status, paidAt: r.paid_at ?? undefined, createdAt: r.created_at });

/** Bank status per office, from the newest enrollment and funded report of each bank. */
async function bankSummary(env: AppEnv, uploads: UploadRow[]) {
  const latest = new Map<string, UploadRow>();
  for (const u of uploads) { const k = `${u.bank_id}:${u.report_type}`; if (!latest.has(k)) latest.set(k, u); }
  const ids = [...latest.values()].map((u) => u.id);
  const byOffice: Record<string, BankStatus> = {};
  const unmatched: UnmatchedRow[] = [];
  if (!ids.length) return { byOffice, unmatched };
  const q = ids.map(() => "?").join(",");
  const rows = await all<{ upload_id: string; bank_id: string; report_type: "enrollment" | "funded"; efin: string; name: string; office_id: string | null; status: string; funded: number; fees_cents: number }>(env.DB, `SELECT upload_id, bank_id, report_type, efin, name, office_id, status, funded, fees_cents FROM mon_bank_rows WHERE upload_id IN (${q})`, ...ids);
  const at = new Map(uploads.map((u) => [u.id, u.created_at]));
  const unm = new Map<string, UnmatchedRow>();
  for (const r of rows) {
    if (!r.office_id) {
      const k = `${r.bank_id}:${r.report_type}:${r.efin}`;
      const u = unm.get(k) ?? { efin: r.efin, name: r.name, bankId: r.bank_id, reportType: r.report_type, funded: 0, feesCents: 0 };
      u.funded += r.funded; u.feesCents += r.fees_cents; unm.set(k, u);
      continue;
    }
    const b = (byOffice[r.office_id] ??= {});
    if (r.report_type === "enrollment") {
      // Several EFINs: "Approved" only when every one is approved; otherwise show the first that isn't.
      const approved = /approv/i.test(r.status);
      if (!b.enrollment || (/approv/i.test(b.enrollment) && !approved)) b.enrollment = r.status || "Listed";
      b.enrollmentAt = at.get(r.upload_id);
    } else {
      b.funded = (b.funded ?? 0) + r.funded;
      b.feesCents = (b.feesCents ?? 0) + r.fees_cents;
      b.fundedAt = at.get(r.upload_id);
    }
  }
  return { byOffice, unmatched: [...unm.values()].sort((x, y) => y.funded - x.funded) };
}

/* ---------------------------------------------------------------- setup lists */
const cents = (v: unknown, label: string) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[$,\s]/g, ""));
  if (!isFinite(n) || n < 0 || n > 1_000_000) throw badRequest(`${label} must be a dollar amount.`);
  return Math.round(n * 100);
};
const url = (v: unknown, label: string) => {
  const s = str(v, 500);
  if (s && !/^https:\/\/[^\s]+$/i.test(s)) throw badRequest(`${label} must start with https://`);
  return s;
};

export type CatalogKind = "packages" | "software" | "banks" | "resellers";
/** Creates or updates one setup record. Amounts arrive in dollars. */
export async function saveCatalog(env: AppEnv, a: Actor, kind: CatalogKind, id: string, b: Record<string, unknown>) {
  need(a, "settings");
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(id)) throw badRequest("Invalid id.");
  const t = now();
  const name = str(b.name, 120);
  if (!name) throw badRequest("Enter a name.");
  const active = b.active === false ? 0 : 1;
  if (kind === "packages") {
    const k = ["package", "seat", "location", "other"].includes(String(b.kind)) ? String(b.kind) : "package";
    const billing = ["season", "once", "monthly"].includes(String(b.billing)) ? String(b.billing) : "season";
    const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
    const features = Array.isArray(b.features) ? b.features.map((f) => str(f, 160)).filter(Boolean).slice(0, 20) : [];
    await run(env.DB, `INSERT INTO mon_packages (id, name, kind, price_cents, billing, locations, seats, ask_ptins, features, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, price_cents = excluded.price_cents, billing = excluded.billing, locations = excluded.locations, seats = excluded.seats, ask_ptins = excluded.ask_ptins, features = excluded.features, active = excluded.active, updated_at = excluded.updated_at`,
      id, name, k, cents(b.price, "Price"), billing, n(b.locations, 500), n(b.seats, 5000), b.askPtins ? 1 : 0, JSON.stringify(features), active, t, t);
  } else if (kind === "software") {
    await run(env.DB, `INSERT INTO mon_software (id, name, sb_fee_cents, download_url, welcome_subject, welcome_body, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, sb_fee_cents = excluded.sb_fee_cents, download_url = excluded.download_url, welcome_subject = excluded.welcome_subject, welcome_body = excluded.welcome_body, active = excluded.active, updated_at = excluded.updated_at`,
      id, name, cents(b.sbFee, "Service bureau fee"), url(b.downloadUrl, "Download link"), str(b.welcomeSubject, 200), (typeof b.welcomeBody === "string" ? b.welcomeBody.replace(/\r/g, "") : "").slice(0, 5000), active, t, t);
  } else if (kind === "banks") {
    await run(env.DB, `INSERT INTO mon_banks (id, name, addon_fee_cents, application_url, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, addon_fee_cents = excluded.addon_fee_cents, application_url = excluded.application_url, active = excluded.active, updated_at = excluded.updated_at`,
      id, name, cents(b.addonFee, "Add-on fee"), url(b.applicationUrl, "Application link"), active, t, t);
  } else if (kind === "resellers") {
    const rate = Number(String(b.rate ?? "").replace(/[%\s]/g, ""));
    if (!isFinite(rate) || rate < 0 || rate > 100) throw badRequest("Commission rate must be between 0% and 100%.");
    const email = str(b.email, 200);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("That email address doesn't look right.");
    await run(env.DB, `INSERT INTO mon_resellers (id, name, contact, email, phone, rate_bp, notes, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, contact = excluded.contact, email = excluded.email, phone = excluded.phone, rate_bp = excluded.rate_bp, notes = excluded.notes, active = excluded.active, updated_at = excluded.updated_at`,
      id, name, str(b.contact, 120), email, str(b.phone, 40), Math.round(rate * 100), str(b.notes, 2000), active, t, t);
  } else throw notFound();
  await note(a, kind === "packages" ? "Package" : kind === "software" ? "Software" : kind === "banks" ? "Bank" : "Reseller", `Saved ${name}`, env);
  return loadAll(env, a);
}

/* ---------------------------------------------------------------- offices */
export async function officeRow(env: AppEnv, id: string) {
  const r = await one<OfficeRow>(env.DB, "SELECT * FROM mon_offices WHERE id = ?", id);
  if (!r) throw notFound("Office not found.");
  return r;
}

const STAGE_KEYS: Stage[] = ["interested", "paid", "collecting", "setup", "active", "inactive"];

function cleanLocations(v: unknown): Location[] {
  if (!Array.isArray(v)) throw badRequest("Invalid locations.");
  const ids = new Set<string>();
  return v.slice(0, 200).map((x: Record<string, unknown>) => {
    const efin = normEfin(x.efin);
    if (efin && efin.length !== 6) throw badRequest("An EFIN has 6 digits.");
    const id = typeof x.id === "string" && /^[A-Za-z0-9_-]{3,40}$/.test(x.id) && !ids.has(x.id) ? x.id : randomId("loc");
    ids.add(id);
    return { id, name: str(x.name, 120) || "Location", address: str(x.address, 240), manager: str(x.manager, 120), efin, ownEfin: x.ownEfin !== false, seats: Math.max(0, Math.min(500, Math.round(Number(x.seats) || 0))) };
  });
}
function cleanPreparers(v: unknown): Preparer[] {
  if (!Array.isArray(v)) throw badRequest("Invalid preparers.");
  const ids = new Set<string>();
  return v.slice(0, 500).map((x: Record<string, unknown>) => {
    const ptin = str(x.ptin, 12).toUpperCase().replace(/\s/g, "");
    if (ptin && !/^P\d{8}$/.test(ptin)) throw badRequest("A PTIN is the letter P followed by 8 digits.");
    const id = typeof x.id === "string" && /^[A-Za-z0-9_-]{3,40}$/.test(x.id) && !ids.has(x.id) ? x.id : randomId("prp");
    ids.add(id);
    return { id, name: str(x.name, 120), ptin, locationId: str(x.locationId, 60) };
  }).filter((p) => p.name);
}
export const sanitizeLocations = cleanLocations;
export const sanitizePreparers = cleanPreparers;

/** After locations change: attach bank report rows for the new EFINs. */
export async function matchRowsToOffice(env: AppEnv, officeId: string, efins: string[]) {
  if (!efins.length) return;
  await run(env.DB, `UPDATE mon_bank_rows SET office_id = ? WHERE office_id IS NULL AND efin IN (${efins.map(() => "?").join(",")})`, officeId, ...efins);
}

export async function createOffice(env: AppEnv, a: Actor, b: Record<string, unknown>) {
  need(a, "create");
  const id = /^[A-Za-z0-9_-]{6,60}$/.test(String(b.id)) ? String(b.id) : randomId("of");
  const name = str(b.name, 160);
  if (!name) throw badRequest("Enter the office name.");
  const email = str(b.email, 200).toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("That email address doesn't look right.");
  const t = now();
  await run(env.DB, `INSERT INTO mon_offices (id, name, contact_name, email, phone, city, state, stage, package_id, software_id, bank_id, reseller_id, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'interested', ?, ?, ?, ?, ?, ?, ?)`,
    id, name, str(b.contactName, 120), email, str(b.phone, 40), str(b.city, 80), str(b.state, 2).toUpperCase(), (await ref(env, "mon_packages", b.packageId)), (await ref(env, "mon_software", b.softwareId)), (await ref(env, "mon_banks", b.bankId)), (await ref(env, "mon_resellers", b.resellerId)), t, staffId(a), t);
  await note(a, `Office ${name}`, "Office added", env);
  return { id, data: await loadAll(env, a) };
}

/** A reference to a setup record (or null). Unknown ids are refused. */
async function ref(env: AppEnv, table: "mon_packages" | "mon_software" | "mon_banks" | "mon_resellers", v: unknown) {
  if (v === undefined || v === null || v === "") return null;
  const id = String(v);
  if (!(await one(env.DB, `SELECT 1 FROM ${table} WHERE id = ?`, id))) throw badRequest("That choice no longer exists. Reload and try again.");
  return id;
}

const FIELDS: Record<string, string> = { name: "name", contactName: "contact_name", email: "email", phone: "phone", city: "city", state: "state", softwareUsername: "software_username", notes: "notes" };

/**
 * Staff changes to an office. `patch` holds changed fields; `item` updates one
 * checklist item. `rev` must match for field changes (someone else may have
 * saved first).
 */
export async function updateOffice(env: AppEnv, a: Actor, id: string, b: { rev?: unknown; patch?: Record<string, unknown>; item?: { key?: unknown; status?: unknown; note?: unknown; date?: unknown } }) {
  need(a, "edit");
  const r = await officeRow(env, id);
  const sets: string[] = [];
  const args: unknown[] = [];
  const changes: string[] = [];
  const p = b.patch ?? {};
  if (Object.keys(p).length && Number(b.rev) !== r.rev) throw new HttpError(409, "This office was changed by someone else (or by the office through their link). Reload to see the latest.", "conflict");
  for (const [k, col] of Object.entries(FIELDS)) {
    if (p[k] === undefined) continue;
    let v = str(p[k], k === "notes" ? 5000 : 200);
    if (k === "name" && !v) throw badRequest("Enter the office name.");
    if (k === "email") { v = v.toLowerCase(); if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw badRequest("That email address doesn't look right."); }
    if (k === "state") v = v.slice(0, 2).toUpperCase();
    sets.push(`${col} = ?`); args.push(v); changes.push(k);
  }
  const refs: [string, "mon_packages" | "mon_software" | "mon_banks" | "mon_resellers", string][] = [["packageId", "mon_packages", "package_id"], ["softwareId", "mon_software", "software_id"], ["bankId", "mon_banks", "bank_id"], ["resellerId", "mon_resellers", "reseller_id"]];
  for (const [k, table, col] of refs) if (p[k] !== undefined) { sets.push(`${col} = ?`); args.push(await ref(env, table, p[k])); changes.push(k); }
  if (p.stage !== undefined) { if (!STAGE_KEYS.includes(p.stage as Stage)) throw badRequest("Unknown stage."); sets.push("stage = ?"); args.push(p.stage); changes.push(`stage → ${p.stage}`); }
  if (p.renewsOn !== undefined) { const d = str(p.renewsOn, 10); if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw badRequest("Invalid renewal date."); sets.push("renews_on = ?"); args.push(d || null); changes.push("renewal date"); }
  for (const [k, col] of [["extraSeats", "extra_seats"], ["extraLocations", "extra_locations"]] as const) if (p[k] !== undefined) { sets.push(`${col} = ?`); args.push(Math.max(0, Math.min(5000, Math.round(Number(p[k]) || 0)))); changes.push(k); }
  let newEfins: string[] = [];
  if (p.locations !== undefined) { const locs = cleanLocations(p.locations); sets.push("locations = ?"); args.push(JSON.stringify(locs)); changes.push("locations"); newEfins = officeEfins({ locations: locs }); }
  if (p.preparers !== undefined) { sets.push("preparers = ?"); args.push(JSON.stringify(cleanPreparers(p.preparers))); changes.push("preparers"); }
  if (b.item) {
    const key = str(b.item.key, 40);
    const status = String(b.item.status);
    if (!key || !["open", "review", "done", "na"].includes(status)) throw badRequest("Invalid checklist change.");
    const cl = json<Record<string, ItemState>>(r.checklist, {});
    cl[key] = { status: status as ItemState["status"], at: now(), by: staffId(a), ...(cl[key]?.sentAt ? { sentAt: cl[key].sentAt } : {}), ...(str(b.item.note, 500) ? { note: str(b.item.note, 500) } : {}), ...(/^\d{4}-\d{2}-\d{2}$/.test(String(b.item.date ?? "")) ? { date: String(b.item.date) } : {}) };
    sets.push("checklist = ?"); args.push(JSON.stringify(cl)); changes.push(`${key}: ${status}`);
  }
  if (!sets.length) return { office: await officeView(env, id) };
  await run(env.DB, `UPDATE mon_offices SET ${sets.join(", ")}, updated_at = ?, rev = rev + 1 WHERE id = ?`, ...args, now(), id);
  if (newEfins.length) await matchRowsToOffice(env, id, newEfins);
  if (p.stage === undefined) await advance(env, id);
  else if (p.stage === "active") await closeLinkIfDone(env, id);
  await note(a, `Office ${r.name}`, changes.join(", ").slice(0, 300), env);
  return { office: await officeView(env, id) };
}

/** One office as the staff screens see it (with files and bank status). */
export async function officeView(env: AppEnv, id: string): Promise<Office> {
  const r = await officeRow(env, id);
  const files = await all<FileRow>(env.DB, "SELECT id, office_id, item, name, size_bytes, uploaded_by, created_at FROM mon_files WHERE office_id = ? AND deleted_at IS NULL ORDER BY created_at", id);
  const ups = await all<UploadRow>(env.DB, "SELECT * FROM mon_bank_uploads ORDER BY created_at DESC LIMIT 50");
  const { byOffice } = await bankSummary(env, ups);
  return toOffice(r, files, byOffice[id]);
}

/** The checklist definitions for an office row. */
export async function itemsFor(env: AppEnv, r: OfficeRow) {
  const [pkg, bank, sw] = await Promise.all([
    r.package_id ? one<PackageRow>(env.DB, "SELECT * FROM mon_packages WHERE id = ?", r.package_id) : null,
    r.bank_id ? one<BankRow>(env.DB, "SELECT * FROM mon_banks WHERE id = ?", r.bank_id) : null,
    r.software_id ? one<SoftwareRow>(env.DB, "SELECT * FROM mon_software WHERE id = ?", r.software_id) : null,
  ]);
  return { items: checklistFor({ bankId: r.bank_id ?? undefined, softwareId: r.software_id ?? undefined }, pkg ? toPackage(pkg) : undefined, bank ? toBank(bank) : undefined, sw ? toSoftware(sw) : undefined), pkg: pkg ? toPackage(pkg) : undefined, bank: bank ? toBank(bank) : undefined, software: sw ? toSoftware(sw) : undefined };
}

/**
 * Moves an office forward automatically (never backward, never out of Inactive):
 * link sent → Collecting documents; everything the office provides done → Setting up;
 * everything done → Active.
 */
export async function advance(env: AppEnv, id: string, opts: { linkSent?: boolean; paid?: boolean } = {}) {
  const r = await officeRow(env, id);
  if (r.stage === "inactive") return;
  const { items } = await itemsFor(env, r);
  const o = toOffice(r);
  const officeDone = items.filter((i) => i.who === "office").every((i) => isDone(itemState(o, i.key)));
  const allDone = items.every((i) => isDone(itemState(o, i.key)));
  let target: Stage = r.stage;
  const bump = (s: Stage) => { if (stageIndex(s) > stageIndex(target)) target = s; };
  if (opts.paid) bump("paid");
  if (opts.linkSent) bump("collecting");
  if (stageIndex(r.stage) >= stageIndex("collecting") || opts.linkSent) {
    if (officeDone) bump("setup");
    if (allDone) bump("active");
  }
  if (target !== r.stage) {
    await run(env.DB, "UPDATE mon_offices SET stage = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", target, now(), id);
    if (target === "active") await closeLinkIfDone(env, id);
  }
}

async function closeLinkIfDone(env: AppEnv, id: string) {
  const s = await loadSettings(env);
  if (s.closeOnActive) await run(env.DB, "UPDATE mon_offices SET link_off_at = ?, updated_at = ? WHERE id = ? AND link_hash IS NOT NULL AND link_off_at IS NULL", now(), now(), id);
}

/** Staff: removes an office that never got going (no sales). Otherwise mark it Inactive. */
export async function deleteOffice(env: AppEnv, a: Actor, id: string) {
  need(a, "delete");
  const r = await officeRow(env, id);
  if (await one(env.DB, "SELECT 1 FROM mon_sales WHERE office_id = ?", id)) throw badRequest("This office has sales on record — mark it Inactive instead.");
  const files = await all<{ r2_key: string }>(env.DB, "SELECT r2_key FROM mon_files WHERE office_id = ?", id);
  for (const f of files) await env.FILES.delete(f.r2_key).catch(() => {});
  await env.DB.batch([
    env.DB.prepare("UPDATE mon_bank_rows SET office_id = NULL WHERE office_id = ?").bind(id),
    env.DB.prepare("DELETE FROM mon_files WHERE office_id = ?").bind(id),
    env.DB.prepare("DELETE FROM mon_offices WHERE id = ?").bind(id),
  ]);
  await note(a, `Office ${r.name}`, "Office deleted", env);
  return loadAll(env, a);
}

/* ---------------------------------------------------------------- website contact form */
/**
 * Public: the contact form on Monarch's website. Creates a new office in the
 * "Interested" stage and rings the bell for Monarch staff. Rate-limited; a
 * hidden field catches bots. Never reads anything back.
 */
export async function websiteInquiry(env: AppEnv, ip: string, b: Record<string, unknown>) {
  if (str(b.website, 200)) return { ok: true }; // spam trap
  if (!(await rateLimitIp(env, ip))) throw new HttpError(429, "Too many requests. Please wait a few minutes and try again.", "rate_limited");
  const name = str(b.name, 120), office = str(b.office, 160), email = str(b.email, 200).toLowerCase(), phone = str(b.phone, 40);
  if (name.length < 2) throw badRequest("Please enter your name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Please enter a valid email address.");
  if (phone.replace(/\D/g, "").length < 10) throw badRequest("Please enter a phone number.");
  if (!b.consent) throw badRequest("Please check the box so we can contact you.");
  // Optional marketing opt-in: subscribed to Monarch marketing email and texts (with where and when).
  if (b.marketing === true) {
    await recordConsent(env, "monarch", "email", email, "subscribed", "Monarch website: contact form", null);
    await recordConsent(env, "monarch", "sms", phone.replace(/\D/g, "").slice(-10), "subscribed", "Monarch website: contact form", null);
  }
  const message = str(b.message, 2000);
  const locations = str(b.locations, 20);
  const t = now();
  const id = randomId("of");
  const notes = [`From the website contact form (${new Date(t).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "America/Chicago" })}).`, locations && `Locations: ${locations}`, message && `Message: ${message}`].filter(Boolean).join("\n");
  await run(env.DB, "INSERT INTO mon_offices (id, name, contact_name, email, phone, city, state, stage, notes, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'interested', ?, ?, NULL, ?)",
    id, office || name, name, email, phone, str(b.city, 80), str(b.state, 2).toUpperCase(), notes, t, t);
  const { notify } = await import("./notifications");
  await notify(env, { module: "monarch" }, { kind: "lead", title: `New Monarch lead: ${office || name}`, body: `${name} filled out the Monarch website form.`, href: `/monarch/offices/${id}` });
  return { ok: true };
}
async function rateLimitIp(env: AppEnv, ip: string) {
  const { rateLimit } = await import("./core");
  return rateLimit(env.DB, `moninq:${ip}`, 5, 60);
}
