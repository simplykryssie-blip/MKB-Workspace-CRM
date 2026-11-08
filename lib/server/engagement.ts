/**
 * Engagement letters — versioned wording. Server-only.
 */
import { DEFAULT_LETTERS, LETTER_INFO, LETTER_KEYS, type Letter, type LetterKey } from "@/lib/engagement/letters";
import { all, badRequest, now, one, type AppEnv } from "./core";
import { audit, requirePermission, requireStaff, type Actor } from "./identity";

type Row = { key: LetterKey; version: number; title: string; body: string; note: string | null; created_at: string; created_by: string | null };
const isKey = (k: string): k is LetterKey => (LETTER_KEYS as string[]).includes(k);
const fromDefault = (k: LetterKey): Letter => ({ key: k, version: 1, ...DEFAULT_LETTERS[k] });
const fromRow = (r: Row): Letter => ({ key: r.key, version: r.version, title: r.title, body: r.body, updatedAt: r.created_at, updatedBy: r.created_by ?? undefined });

/** The current version of every letter. */
export async function currentLetters(env: AppEnv): Promise<Record<LetterKey, Letter>> {
  const rows = await all<Row>(env.DB, "SELECT l.* FROM engagement_letters l JOIN (SELECT key, max(version) v FROM engagement_letters GROUP BY key) m ON m.key = l.key AND m.v = l.version");
  return Object.fromEntries(LETTER_KEYS.map((k) => { const r = rows.find((x) => x.key === k); return [k, r ? fromRow(r) : fromDefault(k)]; })) as Record<LetterKey, Letter>;
}

export async function letterVersion(env: AppEnv, key: string, version: number): Promise<Letter | null> {
  if (!isKey(key)) return null;
  if (version === 1) { const r = await one<Row>(env.DB, "SELECT * FROM engagement_letters WHERE key = ? AND version = 1", key); return r ? fromRow(r) : fromDefault(key); }
  const r = await one<Row>(env.DB, "SELECT * FROM engagement_letters WHERE key = ? AND version = ?", key, version);
  return r ? fromRow(r) : null;
}

export async function listLetters(env: AppEnv, a: Actor) {
  requireStaff(a);
  const [letters, hist] = await Promise.all([currentLetters(env), all<Row>(env.DB, "SELECT key, version, title, '' AS body, note, created_at, created_by FROM engagement_letters ORDER BY key, version DESC")]);
  return { letters, history: Object.fromEntries(LETTER_KEYS.map((k) => [k, [...hist.filter((h) => h.key === k).map((h) => ({ version: h.version, note: h.note ?? undefined, at: h.created_at, by: h.created_by ?? undefined })), ...(hist.some((h) => h.key === k && h.version === 1) ? [] : [{ version: 1, note: "Original draft", at: undefined, by: undefined }])]])) };
}

export async function getLetter(env: AppEnv, a: Actor, key: string, version: number) {
  requireStaff(a);
  const l = await letterVersion(env, key, version);
  if (!l) throw badRequest("That version doesn't exist.");
  return { letter: l };
}

/** Saves an edit as a new version (old versions are kept forever). */
export async function saveLetter(env: AppEnv, a: Actor, key: string, b: { title?: unknown; body?: unknown; note?: unknown }) {
  requirePermission(a, "settings", "settings");
  requireStaff(a);
  if (!isKey(key)) throw badRequest("Unknown letter.");
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const body = typeof b.body === "string" ? b.body.replace(/\r/g, "").trim() : "";
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 200) : "";
  if (!title || title.length > 200) throw badRequest("Enter a title (up to 200 characters).");
  if (body.length < 20 || body.length > 40_000) throw badRequest("The letter must be between 20 and 40,000 characters.");
  const cur = (await currentLetters(env))[key];
  if (cur.title === title && cur.body === body) return { letter: cur, unchanged: true };
  const t = now();
  const stmts = [];
  // Keep the original default on record the first time it's replaced.
  const hasV1 = await one<{ n: number }>(env.DB, "SELECT count(*) n FROM engagement_letters WHERE key = ?", key);
  if (!hasV1?.n) stmts.push(env.DB.prepare("INSERT INTO engagement_letters (key, version, title, body, note, created_at, created_by) VALUES (?, 1, ?, ?, 'Original draft', ?, NULL)").bind(key, DEFAULT_LETTERS[key].title, DEFAULT_LETTERS[key].body, t));
  const version = cur.version + 1;
  stmts.push(env.DB.prepare("INSERT INTO engagement_letters (key, version, title, body, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(key, version, title, body, note || null, t, a.member.id));
  await env.DB.batch(stmts);
  await audit(env.DB, a, { action: "Record update", resource: `Engagement letter — ${LETTER_INFO[key].name}`, meta: `Saved version ${version}${note ? `: ${note}` : ""}` });
  return { letter: (await letterVersion(env, key, version))! };
}
