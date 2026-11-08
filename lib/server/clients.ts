/**
 * Clients — server side: record-level access and the encrypted identifier vault.
 * Knowing a client's ID or URL never grants access. Server-only.
 */
import { clientAccess } from "@/lib/team/policy";
import type { ServiceKey } from "@/lib/types";
import { all, badRequest, forbidden, HttpError, json, notFound, now, one, rateLimit, run, type AppEnv } from "./core";
import { decryptField, encryptField } from "./crypto";
import { audit, hasSensitivePerm, requirePermission, type Actor } from "./identity";

export type ClientRow = { id: string; type: "individual" | "business"; name: string; contact_name: string | null; email: string; phone: string; preferred_contact: string; address: string; business: string | null; status: string; portal: string; tags: string; source: string; lead_id: string | null; since: string; last_activity_at: string; services: string | null };
export const CLIENT_SQL = "SELECT c.*, (SELECT group_concat(service) FROM client_services s WHERE s.client_id = c.id) AS services FROM clients c";

export type VaultField = "tax_id" | "ein" | "dob" | "rp_tax_id";
const FIELDS: VaultField[] = ["tax_id", "ein", "dob", "rp_tax_id"];
const LABEL: Record<VaultField, string> = { tax_id: "full SSN/ITIN", ein: "full EIN", dob: "date of birth", rp_tax_id: "responsible party tax ID" };
/** Which sensitive permission allows revealing / editing each field (any one of them). */
const REVEAL: Record<VaultField, string[]> = { tax_id: ["tax.revealSsn", "exp.revealSsn"], ein: ["tax.ein"], dob: ["tax.viewMasked", "exp.viewMasked"], rp_tax_id: ["tax.revealSsn"] };
const EDIT: Record<VaultField, string[]> = { tax_id: ["tax.editSsn", "exp.editSsn"], ein: ["tax.ein"], dob: ["tax.editSsn", "exp.editSsn"], rp_tax_id: ["tax.editSsn"] };

const toClient = (r: ClientRow, last4: Record<string, string | null>) => ({
  id: r.id, type: r.type, name: r.name, contactName: r.contact_name ?? undefined, email: r.email, phone: r.phone, preferredContact: r.preferred_contact,
  address: json(r.address, {}), business: json(r.business, null), status: r.status, portal: r.portal, tags: json<string[]>(r.tags, []), source: r.source,
  leadId: r.lead_id ?? undefined, since: r.since, lastActivityAt: r.last_activity_at, services: (r.services ? r.services.split(",") : []) as ServiceKey[],
  // Masked only — full values come from the audited reveal endpoint.
  taxIdLast4: last4.tax_id ?? undefined, einLast4: last4.ein ?? undefined, hasDob: last4.dob !== undefined,
});

export async function assignmentSets(env: AppEnv, memberId: string) {
  const [mine, team] = await Promise.all([
    all<{ client_id: string }>(env.DB, "SELECT DISTINCT client_id FROM record_assignments WHERE member_id = ?", memberId),
    all<{ client_id: string }>(env.DB, "SELECT DISTINCT a.client_id FROM record_assignments a JOIN members m ON m.id = a.member_id WHERE m.manager_id = ?", memberId),
  ]);
  return { assigned: new Set(mine.map((x) => x.client_id)), teamAssigned: new Set(team.map((x) => x.client_id)) };
}
export async function last4Map(env: AppEnv, ids: string[]) {
  if (!ids.length) return new Map<string, Record<string, string | null>>();
  const rows = await all<{ owner_id: string; field: string; last4: string | null }>(env.DB, `SELECT owner_id, field, last4 FROM vault WHERE owner_type = 'client' AND owner_id IN (${ids.map(() => "?").join(",")})`, ...ids);
  const m = new Map<string, Record<string, string | null>>();
  rows.forEach((r) => m.set(r.owner_id, { ...m.get(r.owner_id), [r.field]: r.field === "dob" ? null : r.last4 }));
  return m;
}

/** May this actor open this client? (Clients may open only their own record.) */
export async function canOpen(env: AppEnv, a: Actor, row: ClientRow) {
  if (a.kind === "client") return a.clientId === row.id;
  const sets = await assignmentSets(env, a.member.id);
  return clientAccess(a.policy, a.member, { id: row.id, services: (row.services ? row.services.split(",") : []) as ServiceKey[] }, sets);
}

export async function listClients(env: AppEnv, a: Actor) {
  requirePermission(a, "crm", "view");
  if (a.kind !== "staff") throw forbidden();
  const rows = await all<ClientRow>(env.DB, `${CLIENT_SQL} ORDER BY c.name`);
  const sets = await assignmentSets(env, a.member.id);
  const visible = rows.filter((r) => clientAccess(a.policy, a.member, { id: r.id, services: (r.services ? r.services.split(",") : []) as ServiceKey[] }, sets));
  const l4 = await last4Map(env, visible.map((r) => r.id));
  return visible.map((r) => toClient(r, l4.get(r.id) ?? {}));
}

export async function getClient(env: AppEnv, a: Actor, id: string) {
  if (a.kind === "staff") requirePermission(a, "crm", "view");
  const row = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, id);
  if (!row) throw notFound("Client not found.");
  if (!(await canOpen(env, a, row))) {
    await audit(env.DB, a, { action: "Client record access", resource: `Client ${id}`, meta: "Denied — not in scope", success: false });
    throw new HttpError(403, "This client isn't assigned to you.", "not_assigned");
  }
  if (a.kind === "staff") await audit(env.DB, a, { action: "Client record access", resource: `Client ${id}` });
  const l4 = await last4Map(env, [id]);
  return toClient(row, l4.get(id) ?? {});
}

function vaultKey(env: AppEnv) {
  if (!env.ENCRYPTION_KEY) throw new HttpError(500, "Server encryption key is not configured.");
  return { key: env.ENCRYPTION_KEY, version: Number(env.ENCRYPTION_KEY_VERSION ?? 1) };
}
export const aad = (clientId: string, field: VaultField) => `client:${clientId}:${field}`;

/** Reveals one full identifier. Needs record access AND the field's sensitive permission; always audited. */
export async function revealIdentifier(env: AppEnv, a: Actor, id: string, field: VaultField) {
  if (!FIELDS.includes(field)) throw badRequest("Unknown field.");
  if (a.kind !== "staff") throw forbidden();
  const row = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, id);
  if (!row) throw notFound("Client not found.");
  const allowed = (await canOpen(env, a, row)) && REVEAL[field].some((k) => hasSensitivePerm(a, k));
  if (!allowed) {
    await audit(env.DB, a, { action: "Sensitive reveal", resource: `Client ${id} — ${LABEL[field]}`, meta: "Denied: missing record access or reveal permission", success: false });
    throw forbidden("Your role can't reveal this — it needs the separate sensitive-information permission.");
  }
  if (!(await rateLimit(env.DB, `reveal:${a.member.id}`, 60, 60))) throw new HttpError(429, "Too many reveals in the last hour.", "rate_limited");
  const v = await one<{ ciphertext: string; iv: string }>(env.DB, "SELECT ciphertext, iv FROM vault WHERE owner_type = 'client' AND owner_id = ? AND field = ?", id, field);
  if (!v) throw notFound("Not on file.");
  const value = await decryptField(vaultKey(env).key, v, aad(id, field));
  await audit(env.DB, a, { action: "Sensitive reveal", resource: `Client ${id} — ${LABEL[field]}` });
  return { value };
}

/** Stores or replaces an identifier (encrypted). The value is never written to the audit log. */
export async function setIdentifier(env: AppEnv, a: Actor, id: string, field: VaultField, raw: string, kind?: string) {
  if (!FIELDS.includes(field)) throw badRequest("Unknown field.");
  if (a.kind !== "staff") throw forbidden();
  const row = await one<ClientRow>(env.DB, `${CLIENT_SQL} WHERE c.id = ?`, id);
  if (!row) throw notFound("Client not found.");
  if (!(await canOpen(env, a, row)) || !EDIT[field].some((k) => hasSensitivePerm(a, k))) {
    await audit(env.DB, a, { action: "Permission change", resource: `Client ${id} — ${LABEL[field]}`, meta: "Edit denied", success: false });
    throw forbidden("Your role can't change this identifier.");
  }
  let value = raw.trim();
  if (field === "dob") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value))) throw badRequest("Enter the date as YYYY-MM-DD.");
  } else {
    const d = value.replace(/\D/g, "");
    if (d.length !== 9) throw badRequest("Enter all 9 digits.");
    value = field === "ein" ? `${d.slice(0, 2)}-${d.slice(2)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  }
  const { key, version } = vaultKey(env);
  const e = await encryptField(key, value, aad(id, field));
  const last4 = field === "dob" ? null : value.replace(/\D/g, "").slice(-4);
  await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, last4 = excluded.last4, kind = excluded.kind, updated_at = excluded.updated_at, updated_by = excluded.updated_by", id, field, e.ciphertext, e.iv, version, last4, kind ?? null, now(), a.member.id);
  if (field === "dob") await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, 'dob_year', '', '', 0, ?, NULL, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET last4 = excluded.last4, updated_at = excluded.updated_at", id, value.slice(0, 4), now(), a.member.id);
  await audit(env.DB, a, { action: "Permission change", resource: `Client ${id} — ${LABEL[field]} updated`, meta: "Value not logged" });
  return { last4 };
}
