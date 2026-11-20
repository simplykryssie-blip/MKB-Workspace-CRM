/**
 * Daily backup (runs from the daily cron job; never from a browser).
 *
 * 1. Database: a complete SQL snapshot of every table (schema + rows + indexes + triggers), gzipped,
 *    at `db/YYYY-MM-DD.sql.gz` in the private BACKUP bucket. Restorable with
 *    `wrangler d1 execute <db> --remote --file <snapshot.sql>` into an empty database.
 *    Kept: every day for 90 days, then the 1st of each month for 7 years.
 * 2. Files: every object in FILES (client documents, signed letters, PDFs) is copied to
 *    `files/<same key>` when it is new or has changed (compared by ETag). A copy whose original
 *    was deleted is kept for 90 days, then removed (so deletions under the retention policy
 *    reach the backup too).
 * Each run writes `meta/last-run.json` and an audit-log entry ("Backup").
 * Encrypted fields stay encrypted in the snapshot (the key is never written to the backup).
 */
import { forbidden, HttpError, now, rateLimit, type AppEnv } from "./core";
import { audit, type Actor } from "./identity";
import { roleOf } from "@/lib/team/policy";

const DAY = 86_400_000;
const KEEP_DAILY_DAYS = 90;
const KEEP_MONTHLY_DAYS = 7 * 366;
const GONE_KEEP_DAYS = 90;
const MAX_FILE_BYTES = 80 * 1024 * 1024;
const TIME_BUDGET_MS = 20_000;

type Val = string | number | null | ArrayBuffer | Uint8Array;
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export const sqlValue = (v: Val | undefined | boolean): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof ArrayBuffer || v instanceof Uint8Array) return `X'${hex(v)}'`;
  if (Array.isArray(v)) return `X'${hex(new Uint8Array(v as number[]))}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const ident = (n: string) => `"${n.replace(/"/g, '""')}"`;

async function gzip(text: string) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The whole database as SQL text (the same shape `wrangler d1 export` produces). */
export async function dumpDatabase(env: AppEnv) {
  const db = env.DB;
  const objects = (await db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, name").all<{ type: string; name: string; tbl_name: string; sql: string }>()).results;
  const out: string[] = ["PRAGMA defer_foreign_keys=TRUE;"];
  let rows = 0;
  const tables = objects.filter((o) => o.type === "table");
  for (const t of tables) {
    out.push(`${t.sql};`);
    for (let offset = 0; ; offset += 500) {
      const page = (await db.prepare(`SELECT * FROM ${ident(t.name)} LIMIT 500 OFFSET ?`).bind(offset).all<Record<string, Val>>()).results;
      for (const r of page) {
        const cols = Object.keys(r);
        out.push(`INSERT INTO ${ident(t.name)} (${cols.map(ident).join(",")}) VALUES(${cols.map((c) => sqlValue(r[c])).join(",")});`);
      }
      rows += page.length;
      if (page.length < 500) break;
    }
  }
  // Indexes, views and triggers last, so triggers (e.g. the append-only audit log) don't block the inserts.
  for (const o of objects) if (o.type !== "table") out.push(`${o.sql};`);
  return { sql: out.join("\n") + "\n", tables: tables.length, rows };
}

type Gone = Record<string, string>;

export async function runBackup(env: AppEnv) {
  const started = Date.now();
  const bucket = env.BACKUP;
  if (!bucket) return { ok: false, skipped: "No BACKUP bucket is connected." };
  const day = now().slice(0, 10);
  const result = { ok: true, day, db: { key: "", tables: 0, rows: 0, bytes: 0 }, files: { total: 0, copied: 0, unchanged: 0, tooLarge: [] as string[], unfinished: false, removedOld: 0 }, snapshotsRemoved: 0, error: "" };
  try {
    // 1. Database snapshot.
    const dump = await dumpDatabase(env);
    const gz = await gzip(dump.sql);
    result.db = { key: `db/${day}.sql.gz`, tables: dump.tables, rows: dump.rows, bytes: gz.length };
    await bucket.put(result.db.key, gz, { httpMetadata: { contentType: "application/gzip" }, customMetadata: { tables: String(dump.tables), rows: String(dump.rows), at: now() } });

    // Old snapshots: daily for 90 days, then the 1st of each month for 7 years.
    for (let cursor: string | undefined; ; ) {
      const l = await bucket.list({ prefix: "db/", cursor });
      for (const o of l.objects) {
        const d = o.key.slice(3, 13);
        const age = (Date.parse(day) - Date.parse(d)) / DAY;
        if (!Number.isFinite(age)) continue;
        if ((age > KEEP_DAILY_DAYS && !d.endsWith("-01")) || age > KEEP_MONTHLY_DAYS) { await bucket.delete(o.key); result.snapshotsRemoved++; }
      }
      if (!l.truncated) break;
      cursor = l.cursor;
    }

    // 2. Files: copy new or changed objects (what doesn't fit is finished by the 15-minute catch-up).
    await copyFiles(env, bucket, started, day, result.files);
  } catch (e) {
    result.ok = false;
    result.error = String(e).slice(0, 300);
  }
  const summary = { ...result, finishedAt: now(), seconds: Math.round((Date.now() - started) / 100) / 10 };
  try { await bucket.put("meta/last-run.json", JSON.stringify(summary, null, 2), { httpMetadata: { contentType: "application/json" } }); } catch { /* the audit entry below still records it */ }
  await audit(env.DB, { kind: "anonymous", ip: "scheduled job" }, {
    action: "Backup",
    resource: "Daily backup",
    meta: result.ok
      ? `Database: ${result.db.tables} tables, ${result.db.rows} rows. Files: ${result.files.copied} copied, ${result.files.unchanged} unchanged${result.files.unfinished ? " (more tomorrow)" : ""}${result.files.tooLarge.length ? `, ${result.files.tooLarge.length} too large` : ""}.`
      : `Failed: ${result.error}`,
    success: result.ok,
  });
  return summary;
}

/* ------------------------------------------------------------ Owner: status and "Back up now" */
type FileStats = { total: number; copied: number; unchanged: number; tooLarge: string[]; unfinished: boolean; removedOld: number };
/** Copies new or changed files into the backup bucket until the time budget runs out (safe to run again any time). */
async function copyFiles(env: AppEnv, bucket: R2Bucket, started: number, day: string, files: FileStats) {
  const result = { files };
    const copies = new Map<string, string>();
    for (let cursor: string | undefined; ; ) {
      const l = await bucket.list({ prefix: "files/", cursor, include: ["customMetadata"] });
      for (const o of l.objects) copies.set(o.key.slice(6), o.customMetadata?.src_etag ?? "");
      if (!l.truncated) break;
      cursor = l.cursor;
    }
    const seen = new Set<string>();
    outer: for (let cursor: string | undefined; ; ) {
      const l = await env.FILES.list({ cursor, include: ["httpMetadata", "customMetadata"] });
      for (const o of l.objects) {
        seen.add(o.key);
        result.files.total++;
        if (copies.get(o.key) === o.etag) { result.files.unchanged++; continue; }
        if (o.size > MAX_FILE_BYTES) { result.files.tooLarge.push(o.key); continue; }
        if (Date.now() - started > TIME_BUDGET_MS) { result.files.unfinished = true; break outer; }
        const src = await env.FILES.get(o.key);
        if (!src) continue;
        await bucket.put(`files/${o.key}`, await src.arrayBuffer(), { httpMetadata: src.httpMetadata, customMetadata: { ...(src.customMetadata ?? {}), src_etag: src.etag, copied_at: now() } });
        result.files.copied++;
      }
      if (!l.truncated) break;
      cursor = l.cursor;
    }

    // Copies whose original is gone: kept 90 days, then removed. (Only when the full list was read.)
    if (!result.files.unfinished) {
      const goneObj = await bucket.get("meta/gone.json");
      const gone: Gone = goneObj ? ((await goneObj.json()) as Gone) : {};
      const next: Gone = {};
      for (const key of copies.keys()) {
        if (seen.has(key)) continue;
        const since = gone[key] ?? day;
        if ((Date.parse(day) - Date.parse(since)) / DAY > GONE_KEEP_DAYS) { await bucket.delete(`files/${key}`); result.files.removedOld++; }
        else next[key] = since;
      }
      await bucket.put("meta/gone.json", JSON.stringify(next), { httpMetadata: { contentType: "application/json" } });
    }
}

/**
 * Every 15 minutes: if the last daily backup ran out of time before every file was copied,
 * keep copying (within the same time budget) until the backup is complete.
 */
export async function continueFileBackup(env: AppEnv) {
  const bucket = env.BACKUP;
  if (!bucket) return { skipped: true };
  const obj = await bucket.get("meta/last-run.json");
  if (!obj) return { skipped: true };
  const last = (await obj.json()) as { ok?: boolean; day?: string; files?: FileStats; catchUps?: number };
  if (!last.ok || !last.files?.unfinished) return { skipped: true };
  const started = Date.now();
  const files: FileStats = { total: 0, copied: 0, unchanged: 0, tooLarge: [], unfinished: false, removedOld: 0 };
  await copyFiles(env, bucket, started, last.day ?? now().slice(0, 10), files);
  const merged = { ...last, files: { ...files, copied: (last.files.copied ?? 0) + files.copied }, catchUps: (last.catchUps ?? 0) + 1, caughtUpAt: now() };
  await bucket.put("meta/last-run.json", JSON.stringify(merged, null, 2), { httpMetadata: { contentType: "application/json" } });
  if (!files.unfinished) await audit(env.DB, { kind: "anonymous", ip: "scheduled job" }, { action: "Backup", resource: "Daily backup (file copy finished)", meta: `All ${files.total} files backed up after ${merged.catchUps} catch-up run${merged.catchUps === 1 ? "" : "s"}.` });
  return { copied: files.copied, unfinished: files.unfinished };
}

function ownerOnly(a: Actor) {
  if (a.kind !== "staff" || !roleOf(a.policy.roles, a.member)?.isOwner) throw forbidden("Only the owner can manage backups.");
  return a;
}
export async function backupStatus(env: AppEnv, a: Actor) {
  ownerOnly(a);
  if (!env.BACKUP) return { connected: false, last: null, snapshots: [] as { day: string; bytes: number }[] };
  const lastObj = await env.BACKUP.get("meta/last-run.json");
  const last = lastObj ? await lastObj.json() : null;
  const snapshots: { day: string; bytes: number }[] = [];
  for (let cursor: string | undefined; ; ) {
    const l = await env.BACKUP.list({ prefix: "db/", cursor });
    for (const o of l.objects) snapshots.push({ day: o.key.slice(3, 13), bytes: o.size });
    if (!l.truncated) break;
    cursor = l.cursor;
  }
  snapshots.sort((x, y) => y.day.localeCompare(x.day));
  return { connected: true, last, snapshots: snapshots.slice(0, 120) };
}
export async function backupNow(env: AppEnv, a: Actor) {
  const o = ownerOnly(a);
  if (!(await rateLimit(env.DB, `backup-now:${o.member.id}`, 3, 60))) throw new HttpError(429, "Backups were run a few times in the last hour. Try again later.", "rate_limited");
  return runBackup(env);
}
