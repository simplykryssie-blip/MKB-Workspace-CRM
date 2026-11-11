/**
 * Monarch bank reports: staff download a report from the bank's portal (CSV),
 * pick which columns hold the EFIN / status / count / fees (remembered per bank),
 * and the rows are matched to offices by EFIN. The newest report of each type
 * per bank is the one shown, so upload season-to-date funded reports.
 * Server-only.
 */
import { all, badRequest, json, notFound, now, one, run, str, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { advance, efinMap, loadAll, need, normEfin, note, staffId, type OfficeRow } from "./monarch";
import type { ItemState, Layout, Location, ReportType } from "@/lib/monarch/types";
import type { Actor } from "./identity";

/** Splits CSV text into rows (handles quoted commas, quotes and line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur.trim()); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cur.trim()); cur = "";
      if (row.some((x) => x !== "")) out.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur.trim());
  if (row.some((x) => x !== "")) out.push(row);
  return out;
}
const money = (s: string) => { const neg = /^\(.*\)$/.test(s.trim()) || s.trim().startsWith("-"); const v = Number(s.replace(/[^0-9.]/g, "")); return isFinite(v) ? Math.round((neg ? -v : v) * 100) : 0; };

export async function importReport(env: AppEnv, a: Actor, b: { bankId?: unknown; reportType?: unknown; fileName?: unknown; text?: unknown; layout?: Record<string, unknown> }) {
  need(a, "edit");
  const bank = await one<{ id: string; name: string; layouts: string }>(env.DB, "SELECT id, name, layouts FROM mon_banks WHERE id = ?", str(b.bankId, 60));
  if (!bank) throw badRequest("Choose the bank this report is from.");
  const type = b.reportType === "funded" ? "funded" : b.reportType === "enrollment" ? "enrollment" : null;
  if (!type) throw badRequest("Choose the report type.");
  if (typeof b.text !== "string" || !b.text.trim()) throw badRequest("The file is empty.");
  const rows = parseCsv(b.text);
  if (rows.length < 2) throw badRequest("The file has no rows under the header.");
  if (rows.length > 25_001) throw badRequest("That report has more than 25,000 rows. Split it into smaller files.");
  const head = rows[0].map((h) => h.toLowerCase());
  const col = (name: unknown) => { const n = str(name, 120).toLowerCase(); return n ? head.indexOf(n) : -1; };
  const layout: Layout = { efin: str(b.layout?.efin, 120), name: str(b.layout?.name, 120) || undefined, status: str(b.layout?.status, 120) || undefined, count: str(b.layout?.count, 120) || undefined, fees: str(b.layout?.fees, 120) || undefined };
  const ci = { efin: col(layout.efin), name: col(layout.name), status: col(layout.status), count: col(layout.count), fees: col(layout.fees) };
  if (ci.efin < 0) throw badRequest("Choose the column that holds the EFIN.");
  if (type === "enrollment" && ci.status < 0) throw badRequest("Choose the column that holds the enrollment status.");

  // One line per EFIN: enrollment keeps the last status listed; funded adds up.
  const agg = new Map<string, { efin: string; name: string; status: string; funded: number; fees: number }>();
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const efin = normEfin(r[ci.efin]);
    if (efin.length !== 6) { skipped++; continue; }
    const g = agg.get(efin) ?? { efin, name: ci.name >= 0 ? (r[ci.name] ?? "").slice(0, 120) : "", status: "", funded: 0, fees: 0 };
    if (type === "enrollment") g.status = (r[ci.status] ?? "").slice(0, 60);
    else { g.funded += ci.count >= 0 ? Math.max(0, Math.round(Number((r[ci.count] ?? "").replace(/[^0-9.-]/g, "")) || 0)) : 1; g.fees += ci.fees >= 0 ? money(r[ci.fees] ?? "") : 0; }
    agg.set(efin, g);
  }
  if (!agg.size) throw badRequest("No rows had a 6-digit EFIN in the column you chose.");

  // EFIN → office: from every office's locations, plus EFINs matched by hand.
  const offices = await all<Pick<OfficeRow, "id" | "name" | "bank_id" | "locations" | "checklist">>(env.DB, "SELECT id, name, bank_id, locations, checklist FROM mon_offices");
  const map = new Map<string, string>(Object.entries(await efinMap(env)));
  for (const o of offices) for (const l of json<Location[]>(o.locations, [])) { const e = normEfin(l.efin); if (e.length === 6) map.set(e, o.id); }

  const id = randomId("mbu");
  const t = now();
  const list = [...agg.values()];
  const matched = list.filter((g) => map.has(g.efin)).length;
  await run(env.DB, "INSERT INTO mon_bank_uploads (id, bank_id, report_type, file_name, rows, matched, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, bank.id, type, str(b.fileName, 150) || "report.csv", list.length, matched, t, staffId(a));
  const ins = env.DB.prepare("INSERT INTO mon_bank_rows (id, upload_id, bank_id, report_type, efin, name, office_id, status, funded, fees_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (let i = 0; i < list.length; i += 80) await env.DB.batch(list.slice(i, i + 80).map((g) => ins.bind(randomId("mbr"), id, bank.id, type, g.efin, g.name, map.get(g.efin) ?? null, g.status, g.funded, g.fees)));

  // Remember the columns for next time.
  const layouts = json<Record<string, Layout>>(bank.layouts, {});
  layouts[type] = layout;
  await run(env.DB, "UPDATE mon_banks SET layouts = ?, updated_at = ? WHERE id = ?", JSON.stringify(layouts), t, bank.id);

  // "Approved" in this bank's enrollment report checks off the office's bank step.
  let approvedNow = 0;
  if (type === "enrollment") {
    for (const o of offices.filter((x) => x.bank_id === bank.id)) {
      const mine = list.filter((g) => map.get(g.efin) === o.id);
      if (!mine.length || !mine.every((g) => /approv/i.test(g.status))) continue;
      const cl = json<Record<string, ItemState>>(o.checklist, {});
      if (cl.bank_approved?.status === "done") continue;
      cl.bank_approved = { status: "done", at: t, by: "bank report", note: `${bank.name} report ${new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}` };
      await run(env.DB, "UPDATE mon_offices SET checklist = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(cl), t, o.id);
      await advance(env, o.id);
      approvedNow++;
    }
  }
  await note(a, `${bank.name} ${type} report`, `${list.length} EFINs, ${matched} matched${skipped ? `, ${skipped} rows without an EFIN skipped` : ""}`, env);
  return { result: { rows: list.length, matched, skipped, approvedNow }, data: await loadAll(env, a) };
}

/** Ties an EFIN from a bank report to an office (remembered for future reports). */
export async function matchEfin(env: AppEnv, a: Actor, b: { efin?: unknown; officeId?: unknown }) {
  need(a, "edit");
  const efin = normEfin(b.efin);
  if (efin.length !== 6) throw badRequest("Invalid EFIN.");
  const o = await one<{ id: string; name: string }>(env.DB, "SELECT id, name FROM mon_offices WHERE id = ?", str(b.officeId, 60));
  if (!o) throw notFound("Office not found.");
  const map = await efinMap(env);
  map[efin] = o.id;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO mon_settings (key, value, updated_at, updated_by) VALUES ('efinMap', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by").bind(JSON.stringify(map), now(), staffId(a)),
    env.DB.prepare("UPDATE mon_bank_rows SET office_id = ? WHERE efin = ? AND office_id IS NULL").bind(o.id, efin),
  ]);
  await note(a, `Office ${o.name}`, `Bank report EFIN ending ${efin.slice(-3)} matched`, env);
  return loadAll(env, a);
}

export async function deleteUpload(env: AppEnv, a: Actor, id: string) {
  need(a, "delete");
  const u = await one<{ id: string; file_name: string }>(env.DB, "SELECT id, file_name FROM mon_bank_uploads WHERE id = ?", id);
  if (!u) throw notFound("Report not found.");
  await env.DB.batch([env.DB.prepare("DELETE FROM mon_bank_rows WHERE upload_id = ?").bind(id), env.DB.prepare("DELETE FROM mon_bank_uploads WHERE id = ?").bind(id)]);
  await note(a, "Bank report", `Removed ${u.file_name}`, env);
  return loadAll(env, a);
}

export type { ReportType };
