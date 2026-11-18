/**
 * Owner-only: contacts from an old CRM (CSV: Name, Type, Email, Phone, Assigned Staff, Tags).
 * Each row goes to one place:
 *  - "lead": the MKB Leads pipeline (first stage, tags kept, a note with where it came from);
 *  - "monarch": a Monarch office at "Interested" (tags kept in the office notes);
 *  - "skip".
 * Suggested: QuickBooks tags (QB-…) → bookkeeping lead; tax prep tags (e.g. "Tax Prep Leads") → tax
 * preparation lead; tax-pro / Verexa tags → Monarch; the owner's own row → skip.
 * Preview first (nothing saved), then apply with the owner's choices. Duplicates (same email
 * already a client, lead or Monarch office) are skipped, never overwritten. Server-only.
 */
import { all, badRequest, forbidden, HttpError, now, one, rateLimit, run, type AppEnv } from "./core";
import { randomId } from "./crypto";
import { audit, type Actor } from "./identity";
import { roleOf } from "@/lib/team/policy";
import { col, parseCsv } from "./import-identifiers";

export type ContactDest = "lead" | "monarch" | "skip";
/** interests: services named in an "Interested in" column (e.g. Verexa's export); extra: other details kept in the lead's note. */
export type ContactRow = { row: number; name: string; email: string; phone: string; tags: string[]; interests: string[]; value: number; extra: string[]; suggested: ContactDest; why: string; duplicate: string | null };

const MAX = 1_000_000;
const SOURCE = "Old CRM";

function owner(a: Actor) {
  if (a.kind !== "staff" || !roleOf(a.policy.roles, a.member)?.isOwner) throw forbidden("Only the owner can import contacts.");
  return a;
}

/** "Eraka Childs Eraka Childs" → "Eraka Childs"; "Stephanie Costley Costley" → "Stephanie Costley". */
export function tidyName(n: string) {
  const w = n.trim().split(/\s+/);
  if (w.length % 2 === 0 && w.length >= 2) {
    const h = w.length / 2;
    if (w.slice(0, h).join(" ").toLowerCase() === w.slice(h).join(" ").toLowerCase()) return w.slice(0, h).join(" ");
  }
  return w.filter((x, i) => i === 0 || x.toLowerCase() !== w[i - 1].toLowerCase()).join(" ");
}
/** Common misspellings of big email domains (likely typos). */
const TYPO_DOMAINS = /@(?:(?:gmsil|gmial|gmai|gamil|gnail|yaho|yahooo|hotmial|hotmal|iclod|icoud|outlok|outloo)\.com|(?:gmail|yahoo|icloud|hotmail|outlook|aol)\.(?:co|con|cm|om|comm))$/i;

const digits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const fmtPhone = (s: string) => { const d = digits(s); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s.trim().slice(0, 40); };

async function read(env: AppEnv, a: Extract<Actor, { kind: "staff" }>, csv: string): Promise<ContactRow[]> {
  if (csv.length > MAX) throw new HttpError(413, "That file is too large (1 MB max).");
  const rows = parseCsv(csv.replace(/^﻿/, ""));
  const hi = rows.findIndex((r) => r.some((c) => /^name$/i.test(c.trim())) && r.some((c) => /e-?mail/i.test(c)));
  if (hi < 0) throw badRequest("Couldn't find the header row — the file needs Name and Email columns.");
  const h = rows[hi];
  const iN = col(h, /^name$/i), iE = col(h, /e-?mail/i), iP = col(h, /phone/i), iT = col(h, /^tags?$/i);
  // Also understood: a CRM lead export (Interested in, Source, Stage, Est. value), e.g. Verexa's Leads → Export.
  const iI = col(h, /^interest(ed)?( in)?$|^services?$/i), iSrc = col(h, /^source$/i), iSd = col(h, /^source detail$/i), iStg = col(h, /^stage$/i), iV = col(h, /^est\.? ?value$|^value$/i);
  const me = (a.member.name ?? "").trim().toLowerCase();
  const myEmail = (await one<{ email: string }>(env.DB, "SELECT lower(email) AS email FROM users WHERE id = ?", a.userId))?.email ?? "";
  const clients = new Set((await all<{ e: string }>(env.DB, "SELECT lower(email) AS e FROM clients WHERE email != ''")).map((x) => x.e));
  const leads = new Set((await all<{ e: string }>(env.DB, "SELECT lower(email) AS e FROM leads WHERE email != ''")).map((x) => x.e));
  const offices = new Set((await all<{ e: string }>(env.DB, "SELECT lower(email) AS e FROM mon_offices WHERE email != ''")).map((x) => x.e));
  const seen = new Set<string>();
  // Pass 1: the owner's own rows (by name or email) give their phone numbers; other rows sharing one look like a duplicate of you.
  const looksLikeMe = (name: string, email: string) => (myEmail && email === myEmail) || (me && name.toLowerCase().startsWith(me));
  const myPhones = new Set(rows.slice(hi + 1).filter((r) => looksLikeMe((r[iN] ?? "").trim(), (r[iE] ?? "").trim().toLowerCase())).map((r) => digits(iP >= 0 ? r[iP] ?? "" : "")).filter((d) => d.length === 10));
  const phoneCount = new Map<string, number>();
  rows.slice(hi + 1).forEach((r) => { const d = digits(iP >= 0 ? r[iP] ?? "" : ""); if (d.length === 10) phoneCount.set(d, (phoneCount.get(d) ?? 0) + 1); });
  const out: ContactRow[] = [];
  rows.slice(hi + 1).forEach((r, k) => {
    const name = tidyName((r[iN] ?? "").trim()).slice(0, 160);
    const email = (r[iE] ?? "").trim().toLowerCase().slice(0, 200);
    if (!name && !email) return;
    const phone = iP >= 0 ? fmtPhone(r[iP] ?? "") : "";
    const tags = iT >= 0 ? (r[iT] ?? "").split(";").map((t) => t.trim()).filter(Boolean).slice(0, 20) : [];
    const interests = iI >= 0 ? (r[iI] ?? "").split(/[;,|]/).map((t) => t.trim()).filter(Boolean).slice(0, 10) : [];
    const value = iV >= 0 ? Math.max(0, Math.min(10_000_000, Number(String(r[iV] ?? "").replace(/[^\d.]/g, "")) || 0)) : 0;
    const extra = [iSrc >= 0 && r[iSrc]?.trim() ? `Source: ${r[iSrc].trim()}${iSd >= 0 && r[iSd]?.trim() ? ` (${r[iSd].trim()})` : ""}` : "", iStg >= 0 && r[iStg]?.trim() ? `Stage there: ${r[iStg].trim()}` : ""].filter(Boolean).map((x) => x.slice(0, 160));
    const tagText = [...tags, ...interests].join(" ").toLowerCase();
    let suggested: ContactDest = "lead", why = "Default: MKB lead";
    if (/\bqb-|bookkeeping/.test(tagText)) { suggested = "lead"; why = "QuickBooks / bookkeeping → MKB bookkeeping lead"; }
    else if (/tax ?prep|tax return|tax client/.test(tagText)) { suggested = "lead"; why = "Tax prep tags → MKB tax preparation lead"; }
    else if (/tax pro|verexa/.test(tagText)) { suggested = "monarch"; why = "Tax-pro tags → Monarch office"; }
    const d = digits(phone);
    if (looksLikeMe(name, email)) { suggested = "skip"; why = "Looks like you"; }
    else if (d.length === 10 && myPhones.has(d)) { suggested = "skip"; why = "Same phone number as your own row — probably you or a test"; }
    else if (TYPO_DOMAINS.test(email)) { suggested = "skip"; why = `Email may have a typo (${email.split("@")[1]}) — check before importing`; }
    else if (d.length === 10 && (phoneCount.get(d) ?? 0) > 1) why = `${why} · same phone as another row in this file`;
    const badEmail = !!email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    const duplicate = badEmail ? "Email doesn't look right" : seen.has(email) && email ? "Twice in this file" : clients.has(email) ? "Already a client" : leads.has(email) ? "Already a lead" : offices.has(email) ? "Already a Monarch office" : null;
    if (email) seen.add(email);
    out.push({ row: hi + k + 2, name: name || email, email, phone, tags, interests, value, extra, suggested: duplicate ? "skip" : suggested, why: duplicate ?? why, duplicate });
  });
  if (!out.length) throw badRequest("No contacts found under the header row.");
  if (out.length > 2000) throw badRequest("That's more than 2,000 contacts — split the file.");
  return out;
}

/** Preview: what each row would become. Nothing is saved. */
export async function previewContacts(env: AppEnv, a: Actor, b: { csv?: unknown }) {
  const s = owner(a);
  if (typeof b.csv !== "string") throw badRequest("Choose the CSV file.");
  return { rows: await read(env, s, b.csv) };
}

/** Apply: imports each row to the destination the owner chose (by row number). Duplicates are always skipped. */
export async function applyContacts(env: AppEnv, a: Actor, b: { csv?: unknown; choices?: unknown }) {
  const s = owner(a);
  if (typeof b.csv !== "string") throw badRequest("Choose the CSV file.");
  if (!(await rateLimit(env.DB, `contactimport:${s.userId}`, 10, 60))) throw new HttpError(429, "Too many imports in the last hour.", "rate_limited");
  const choices = (b.choices && typeof b.choices === "object" ? b.choices : {}) as Record<string, unknown>;
  const rows = await read(env, s, b.csv);
  const stage = await one<{ id: string }>(env.DB, "SELECT id FROM lead_stages ORDER BY position LIMIT 1");
  if (!stage) throw badRequest("Set up the lead pipeline first.");
  await run(env.DB, "INSERT OR IGNORE INTO lead_sources (name, position) VALUES (?, 99)", SOURCE);
  const t = now();
  const done = { lead: 0, monarch: 0, skipped: 0 };
  for (const r of rows) {
    const pick = choices[String(r.row)];
    const dest: ContactDest = r.duplicate ? "skip" : pick === "lead" || pick === "monarch" || pick === "skip" ? pick : r.suggested;
    if (dest === "skip") { done.skipped++; continue; }
    const tagLine = r.tags.length ? `Tags in the old CRM: ${r.tags.join("; ")}` : "No tags in the old CRM";
    if (dest === "lead") {
      const id = `L-${randomId("w").slice(2)}`;
      const all = [...r.tags, ...r.interests];
      const books = all.some((x) => /^qb-|bookkeeping/i.test(x));
      const tax = all.some((x) => /tax ?prep|tax return|tax client/i.test(x));
      const biz = all.some((x) => /business (services|solutions)/i.test(x));
      const intakeDone = r.tags.some((x) => /intake-submitted/i.test(x));
      await env.DB.batch([
        env.DB.prepare("INSERT INTO leads (id, type, name, contact_name, email, phone, address, business, source, source_detail, interests, est_value, owner_id, stage_id, status, priority, tags, created_at, last_activity_at) VALUES (?, 'individual', ?, NULL, ?, ?, NULL, NULL, ?, 'Imported contacts', ?, ?, ?, ?, 'open', 'medium', ?, ?, ?)")
          .bind(id, r.name, r.email, r.phone, SOURCE, JSON.stringify([...(books ? ["books"] : []), ...(tax ? ["tax"] : []), ...(biz ? ["biz"] : [])]), r.value, s.member.id, stage.id, JSON.stringify([...new Set([...r.tags.map((x) => x.slice(0, 40)), "Imported"])].slice(0, 12)), t, t),
        env.DB.prepare("INSERT INTO lead_notes (id, lead_id, author_id, body, at) VALUES (?, ?, ?, ?, ?)").bind(randomId("n"), id, s.member.id, `Imported from the old CRM.\n${tagLine}${r.interests.length ? `\nInterested in: ${r.interests.join(", ")}` : ""}${r.extra.length ? `\n${r.extra.join("\n")}` : ""}${intakeDone ? "\nThe old CRM shows their QuickBooks intake as submitted — it isn't in this CRM; send a new bookkeeping intake if needed." : ""}`, t),
        env.DB.prepare("INSERT INTO lead_activity (id, lead_id, kind, text, actor, at) VALUES (?, ?, 'lead', ?, 'system', ?)").bind(randomId("x"), id, "Lead imported from the old CRM", t),
      ]);
      done.lead++;
    } else {
      const id = randomId("of");
      await run(env.DB, "INSERT INTO mon_offices (id, name, contact_name, email, phone, city, state, stage, notes, created_at, created_by, updated_at) VALUES (?, ?, ?, ?, ?, '', '', 'interested', ?, ?, ?, ?)",
        id, r.name, r.name, r.email, r.phone, `Imported from the old CRM. ${tagLine}`, t, s.member.id, t);
      done.monarch++;
    }
  }
  await audit(env.DB, s, { action: "Record update", resource: "Contacts import", meta: `${done.lead} leads, ${done.monarch} Monarch offices, ${done.skipped} skipped` });
  return done;
}
