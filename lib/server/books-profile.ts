/**
 * A submitted bookkeeping intake updates the client's profile, the same way the
 * tax interview does: legal business name, business type, state formed, start
 * date, industry, year end, business address, phone and email — and the first
 * owner as the contact person when none is on file. (The EIN is already saved,
 * encrypted, on the profile the moment it's entered.) Every change is written to
 * the client's activity; when a client changes something that was already on
 * file, staff are notified. Server-only.
 */
import { json, now, one, run, type AppEnv } from "./core";
import { decryptField, encryptField, randomId } from "./crypto";
import { aad as vaultAad, vaultKey } from "./clients";
import { audit, type Actor, type LinkActor } from "./identity";
import { notify } from "./notifications";
import { compareName } from "./name-sync";

type Change = { label: string; kind: "added" | "changed"; from?: string; to: string };
type Biz = { legalName?: string; entityType?: string; state?: string; formedAt?: string; industry?: string; fiscalYearEnd?: string; [k: string]: unknown };

const ENTITY: Record<string, string> = {
  "Sole proprietorship": "Sole Prop",
  "Single-member LLC": "LLC",
  "Multi-member LLC": "LLC",
  "S corporation": "S-Corp",
  "C corporation": "C-Corp",
  Partnership: "Partnership",
  Nonprofit: "Nonprofit",
};
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const digits = (v: string) => v.replace(/\D/g, "");

export async function applyBooksIntakeToProfile(env: AppEnv, clientId: string, answers: Record<string, unknown>, o: { actor: Actor | LinkActor; memberId: string | null; byClient: boolean; source?: string; module?: "books" | "biz" | "exp" }) {
  const c = await one<{ name: string; type: string; contact_name: string | null; email: string | null; phone: string | null; address: string | null; business: string | null }>(env.DB, "SELECT name, type, contact_name, email, phone, address, business FROM clients WHERE id = ?", clientId);
  if (!c) return { changed: [] as Change[] };
  const t = now();
  const changes: Change[] = [];
  const track = (label: string, from: string | undefined, to: string, same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()) => {
    if (!to || (from && same(from, to))) return false;
    changes.push({ label, kind: from ? "changed" : "added", from: from || undefined, to });
    return true;
  };

  // Business details
  const biz = json<Biz>(c.business, {});
  const next: Biz = { ...biz };
  const legal = s(answers.legalName);
  if (track("legal business name", biz.legalName, legal)) next.legalName = legal;
  let entity = ENTITY[s(answers.entity)] ?? "";
  if (entity === "LLC") entity = s(answers.llcTax) === "Elected S corporation" ? "S-Corp" : s(answers.llcTax) === "Elected C corporation" ? "C-Corp" : "LLC";
  if (track("business type", biz.entityType, entity)) next.entityType = entity;
  const formState = s(answers.formState);
  if (track("state formed", biz.state, formState)) next.state = formState;
  const formed = /^\d{4}-\d{2}-\d{2}$/.test(s(answers.formed)) ? s(answers.formed) : "";
  if (track("business start date", biz.formedAt, formed)) next.formedAt = formed;
  const industry = s(answers.industry) === "Other" ? s(answers.industryOther) : s(answers.industry);
  if (track("industry", biz.industry, industry)) next.industry = industry;
  const fye = s(answers.fyEnd).startsWith("December") ? "December" : s(answers.fyEndMonth);
  if (track("business year end", biz.fiscalYearEnd, fye)) next.fiscalYearEnd = fye;

  // Contact details
  const addrNow = json<Record<string, string>>(c.address, {});
  const addrNew = s(answers.street) && s(answers.city) && s(answers.state) ? { ...addrNow, line1: s(answers.street), city: s(answers.city), state: s(answers.state), zip: s(answers.zip) } : null;
  const fmt = (x: Record<string, string>) => [x.line1, x.city, [x.state, x.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const addrChanged = !!addrNew && track(c.type === "business" ? "business address" : "address", fmt(addrNow), fmt(addrNew));
  const phone = s(answers.phone);
  const phoneChanged = digits(phone).length >= 10 && track("phone", c.phone ?? "", phone, (a, b) => digits(a) === digits(b));
  const email = s(answers.email).toLowerCase();
  const emailChanged = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && track("email", c.email ?? "", email);
  // First owner becomes the contact person when there isn't one yet.
  const owner = (Array.isArray(answers.owners) ? (answers.owners as Record<string, unknown>[]) : [])[0] ?? {};
  const ownerName = s(owner.name);
  // Individuals: the client's own full name (from "Full legal name", or the owner on a sole proprietor's intake).
  let newName = c.name;
  let differentName = "";
  if (c.type !== "business") {
    const nm = compareName(c.name, s(answers.fullName) || ownerName);
    if (nm.kind === "upgrade" && track("name", c.name, nm.name, () => false)) newName = nm.name;
    else if (nm.kind === "different") differentName = nm.name;
  }
  const contactAdded = !c.contact_name && !!ownerName && track("contact person", "", ownerName);
  if (ownerName && !(next.responsibleParty as { name?: string } | undefined)?.name) next.responsibleParty = { name: ownerName, title: s(owner.title) || "Owner" };

  // Date of birth (individuals): kept encrypted in the vault, like the tax interview does it.
  const dob = s(answers.dob);
  if (c.type !== "business" && /^\d{4}-\d{2}-\d{2}$/.test(dob) && !isNaN(Date.parse(dob)) && env.ENCRYPTION_KEY) {
    const { key, version } = vaultKey(env);
    const v = await one<{ ciphertext: string; iv: string }>(env.DB, "SELECT ciphertext, iv FROM vault WHERE owner_type = 'client' AND owner_id = ? AND field = 'dob'", clientId);
    const cur = v ? await decryptField(key, v, vaultAad(clientId, "dob")).catch(() => null) : null;
    if (cur !== dob) {
      const by = o.memberId ?? (o.actor.kind === "link" ? `link:${o.actor.linkId}` : "system");
      const e = await encryptField(key, dob, vaultAad(clientId, "dob"));
      const t2 = now();
      await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, 'dob', ?, ?, ?, NULL, NULL, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, key_version = excluded.key_version, updated_at = excluded.updated_at, updated_by = excluded.updated_by", clientId, e.ciphertext, e.iv, version, t2, by);
      await run(env.DB, "INSERT INTO vault (owner_type, owner_id, field, ciphertext, iv, key_version, last4, kind, updated_at, updated_by) VALUES ('client', ?, 'dob_year', '', '', 0, ?, NULL, ?, ?) ON CONFLICT(owner_type, owner_id, field) DO UPDATE SET last4 = excluded.last4, updated_at = excluded.updated_at", clientId, dob.slice(0, 4), t2, by);
      // The date itself stays out of the activity log.
      changes.push({ label: "date of birth", kind: cur ? "changed" : "added", from: cur ? "the one on file" : undefined, to: "saved securely" });
    }
  }

  if (differentName) {
    // Never overwrite a different name — tell staff instead.
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', ?, ?, ?, ?)", randomId("x"), clientId, `The ${o.source ?? "bookkeeping intake"} gives the name "${differentName}", which is different from the name on file — check it and update the profile if needed`, o.byClient ? "client" : "staff", o.memberId, now());
    await notify(env, { module: o.module ?? "books" }, { kind: "intake", title: `Name check: ${c.name}`, body: `The ${o.source ?? "bookkeeping intake"} gives the name "${differentName}". The profile wasn't changed.`, href: `/clients/${clientId}` });
  }

  if (!changes.length && JSON.stringify(next) === JSON.stringify(biz)) return { changed: changes };
  if (newName !== c.name) await run(env.DB, "UPDATE clients SET name = ? WHERE id = ?", newName, clientId);
  await run(env.DB, "UPDATE clients SET business = ?, address = ?, phone = ?, email = ?, contact_name = ?, rev = rev + 1, updated_at = ? WHERE id = ?",
    c.business === null && !Object.keys(next).length ? null : JSON.stringify(next), addrChanged && addrNew ? JSON.stringify(addrNew) : c.address, phoneChanged ? phone : c.phone, emailChanged ? email : c.email, contactAdded ? ownerName : c.contact_name, t, clientId);
  if (changes.length) {
    const text = (x: Change) => (x.kind === "changed" ? `${x.label} changed (was ${x.from}, now ${x.to})` : `${x.label} added (${x.to})`);
    await run(env.DB, "INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', ?, ?, ?, ?)", randomId("x"), clientId, `Profile updated from the ${o.source ?? "bookkeeping intake"} by ${o.byClient ? "the client" : "staff"}: ${changes.map(text).join("; ")}`, o.byClient ? "client" : "staff", o.memberId, t);
    await audit(env.DB, o.actor, { action: "Record update", resource: `Client ${clientId}`, department: o.module ?? "books", meta: `Profile updated from ${o.source ?? "bookkeeping intake"}: ${changes.map((x) => `${x.label} ${x.kind}`).join(", ")}` });
    const changed = changes.filter((x) => x.kind === "changed");
    if (o.byClient && changed.length) await notify(env, { module: o.module ?? "books" }, { kind: "intake", title: `${c.name} changed information already on their profile`, body: `In the ${o.source ?? "bookkeeping intake"}: ${changed.map(text).join("; ")}`, href: `/clients/${clientId}#activity` });
  }
  return { changed: changes };
}
