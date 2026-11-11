/**
 * Owner-only: bring SSNs and dates of birth over from an old spreadsheet (CSV).
 * Each row is matched to an existing client by email (then by name), and the
 * numbers are encrypted here on the server like any other identifier. Nothing
 * sensitive is returned — only which clients were updated. Server-only.
 */
import { all, badRequest, forbidden, HttpError, now, rateLimit, type AppEnv } from "./core";
import { audit, type Actor } from "./identity";
import { roleOf } from "@/lib/team/policy";
import { vaultStatements } from "./client-records";

const MAX = 1_000_000;

/** Minimal RFC 4180 CSV reader (quoted fields, commas and newlines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ",") { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const col = (hdr: string[], ...names: RegExp[]) => hdr.findIndex((h) => names.some((n) => n.test(h.trim())));

/** M/D/YYYY, MM/DD/YY, YYYY-MM-DD → YYYY-MM-DD (or null). */
function isoDate(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (!m) return null;
  let y = +m[3];
  if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  return valid(y, +m[1], +m[2]);
}
function valid(y: number, mo: number, d: number) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || y < 1900 || dt > new Date()) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
/** 9 digits; spreadsheet numbers can drop leading zeros or gain ".0". */
function ssnDigits(v: string): string | null {
  let d = v.trim().replace(/\.0+$/, "").replace(/\D/g, "");
  if (d.length >= 7 && d.length < 9 && /^\d+$/.test(v.trim().replace(/\.0+$/, ""))) d = d.padStart(9, "0");
  if (d.length !== 9 || /^(000|666|9)/.test(d) || d.slice(3, 5) === "00" || d.slice(5) === "0000") return null;
  return d;
}

export type ImportRow = { row: number; name: string; client?: string; clientId?: string; ssn: "saved" | "kept" | "invalid" | "missing" | "would_save"; dob: "saved" | "kept" | "invalid" | "missing" | "would_save"; note?: string };

export async function importIdentifiers(env: AppEnv, a: Actor, req: Request, opts: { apply: boolean; overwrite: boolean }) {
  if (a.kind !== "staff" || !roleOf(a.policy.roles, a.member)?.isOwner) throw forbidden("Only the owner can import SSNs and dates of birth.");
  if (!(await rateLimit(env.DB, `idimport:${a.userId}`, 20, 60))) throw new HttpError(429, "Too many imports in the last hour.", "rate_limited");
  const text = await req.text();
  if (text.length > MAX) throw new HttpError(413, "That file is too large (1 MB max).");
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const hi = rows.findIndex((r) => r.some((c) => /first\s*name/i.test(c)));
  if (hi < 0) throw badRequest("Couldn't find the header row — the file needs FIRST NAME, LAST NAME, EMAIL, an SSN column and DATE OF BIRTH.");
  const hdr = rows[hi];
  const iF = col(hdr, /^first\s*name$/i), iL = col(hdr, /^last\s*name$/i), iE = col(hdr, /e-?mail/i), iS = col(hdr, /ss\s*#|ssn|social|taxpayer\s*id|itin/i), iD = col(hdr, /date\s*of\s*birth|^dob$|birth/i);
  if (iF < 0 || iL < 0 || (iS < 0 && iD < 0)) throw badRequest("The file needs FIRST NAME and LAST NAME columns, plus an SSN and/or DATE OF BIRTH column.");
  const clients = await all<{ id: string; name: string; email: string; status: string }>(env.DB, "SELECT id, name, lower(email) email, status FROM clients WHERE status NOT IN ('declined')");
  const have = await all<{ owner_id: string; field: string }>(env.DB, "SELECT owner_id, field FROM vault WHERE owner_type = 'client' AND field IN ('tax_id', 'dob') AND ciphertext != ''");
  const has = (id: string, f: string) => have.some((h) => h.owner_id === id && h.field === f);
  const out: ImportRow[] = [];
  const seen = new Set<string>();
  let saved = 0;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = `${(r[iF] ?? "").trim()} ${(r[iL] ?? "").trim()}`.trim();
    if (!name) continue;
    const email = iE >= 0 ? (r[iE] ?? "").trim().toLowerCase() : "";
    const c = (email && clients.find((x) => x.email === email)) || clients.find((x) => norm(x.name) === norm(name));
    const ssn = iS >= 0 ? ssnDigits(r[iS] ?? "") : null;
    const dob = iD >= 0 ? isoDate(r[iD] ?? "") : null;
    const base: ImportRow = { row: i + 1, name, ssn: iS < 0 || !(r[iS] ?? "").trim() ? "missing" : ssn ? "would_save" : "invalid", dob: iD < 0 || !(r[iD] ?? "").trim() ? "missing" : dob ? "would_save" : "invalid" };
    if (!c) { out.push({ ...base, note: "No matching client (by email or name)" }); continue; }
    if (seen.has(c.id)) { out.push({ ...base, client: c.name, clientId: c.id, ssn: base.ssn === "would_save" ? "kept" : base.ssn, dob: base.dob === "would_save" ? "kept" : base.dob, note: "Same client as an earlier row — used the first row" }); continue; }
    seen.add(c.id);
    const row: ImportRow = { ...base, client: c.name, clientId: c.id };
    if (row.ssn === "would_save" && has(c.id, "tax_id") && !opts.overwrite) row.ssn = "kept";
    if (row.dob === "would_save" && has(c.id, "dob") && !opts.overwrite) row.dob = "kept";
    if (opts.apply && (row.ssn === "would_save" || row.dob === "would_save")) {
      const stmts = await vaultStatements(env, a, c.id, { ...(row.ssn === "would_save" ? { taxId: ssn!, taxIdType: "SSN" as const } : {}), ...(row.dob === "would_save" ? { dob: dob! } : {}) });
      stmts.push(env.DB.prepare("INSERT INTO client_activity (id, client_id, kind, text, actor, member_id, at) VALUES (?, ?, 'status', ?, 'staff', ?, ?)").bind(`x_${crypto.randomUUID()}`, c.id, `${[row.ssn === "would_save" && "SSN", row.dob === "would_save" && "date of birth"].filter(Boolean).join(" and ")} imported from the old client spreadsheet (encrypted)`, a.member.id, now()));
      await env.DB.batch(stmts);
      if (row.ssn === "would_save") row.ssn = "saved";
      if (row.dob === "would_save") row.dob = "saved";
      saved++;
    }
    out.push(row);
  }
  if (opts.apply) await audit(env.DB, a, { action: "Record update", resource: "Client identifiers import", meta: `Imported SSN/date of birth for ${saved} client(s) from a CSV (values encrypted; not logged)` }).catch(() => {});
  return { applied: opts.apply, rows: out, updated: saved };
}
