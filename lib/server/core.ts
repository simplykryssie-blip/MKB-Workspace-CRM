/**
 * Server core: environment, database helpers, HTTP handling, errors.
 * Server-only.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Bindings from wrangler.jsonc plus secrets (set with `wrangler secret put`, or .dev.vars locally). */
export type AppEnv = Omit<CloudflareEnv, "APP_ENV" | "BACKEND_ENABLED"> & {
  APP_ENV: string;
  BACKEND_ENABLED: string;
  /** 32 random bytes, base64 — encrypts SSNs, EINs, dates of birth, bank numbers and MFA secrets. */
  ENCRYPTION_KEY?: string;
  ENCRYPTION_KEY_VERSION?: string;
  /** Resend API key. Without it, emails are written to the outbox table instead of being sent. */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Public origin of the app, e.g. https://suite.mkbfinancial.example — used for links and request-origin checks. */
  APP_ORIGIN?: string;
  /** One-time link secret for creating the Owner account in an empty database. */
  OWNER_SETUP_TOKEN?: string;
  /** Development only: password given to sample team members by the dev seed. */
  DEV_SEED_PASSWORD?: string;
};

export async function getEnv(): Promise<AppEnv> {
  return (await getCloudflareContext({ async: true })).env as AppEnv;
}
export const isDev = (env: AppEnv) => env.APP_ENV === "development";
export const now = () => new Date().toISOString();
export const addMinutes = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60_000).toISOString();

/* ---------------------------------------------------------------- database */
export type Db = D1Database;
export async function all<T>(db: Db, sql: string, ...args: unknown[]): Promise<T[]> {
  return (await db.prepare(sql).bind(...args).all<T>()).results;
}
export async function one<T>(db: Db, sql: string, ...args: unknown[]): Promise<T | null> {
  return db.prepare(sql).bind(...args).first<T>();
}
export async function run(db: Db, sql: string, ...args: unknown[]) {
  return db.prepare(sql).bind(...args).run();
}
export const json = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

/* ---------------------------------------------------------------- HTTP */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}
export const forbidden = (message = "You don't have permission to do that.") => new HttpError(403, message, "forbidden");
export const notFound = (message = "Not found.") => new HttpError(404, message, "not_found");
export const badRequest = (message: string) => new HttpError(400, message, "bad_request");

const NO_STORE = { "cache-control": "no-store", "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" };
export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...NO_STORE, ...headers } });
}

export const clientIp = (req: Request) => req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";

/**
 * Blocks cross-site requests that change data: they must be JSON and come from
 * the app's own origin. (Session cookies are also SameSite=Lax.)
 */
export function checkSameOrigin(req: Request, env: AppEnv, rawBody = false) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  const allowed = env.APP_ORIGIN ?? new URL(req.url).origin;
  if (!origin || origin !== allowed) throw new HttpError(403, "Request blocked (cross-site).", "bad_origin");
  if (!rawBody && !(req.headers.get("content-type") ?? "").includes("application/json")) throw new HttpError(415, "Send JSON.", "bad_content_type");
}

/** Parses a JSON body (max 64 KB). */
export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  const text = await req.text();
  if (text.length > 65_536) throw new HttpError(413, "Request too large.");
  try { return (text ? JSON.parse(text) : {}) as T; } catch { throw badRequest("Invalid JSON."); }
}
export const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Wraps a route handler: errors become JSON responses; unexpected errors are hidden from the caller. */
/** `rawBody`: the route reads a file upload instead of JSON (the same-origin check still applies). */
export function handle<P extends Record<string, string> = Record<string, never>>(fn: (req: Request, env: AppEnv, params: P) => Promise<Response>, opts: { rawBody?: boolean } = {}) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    let env: AppEnv | undefined;
    try {
      env = await getEnv();
      if (env.BACKEND_ENABLED !== "true" && !isDev(env)) return jsonResponse({ error: "Backend not enabled." }, 503);
      checkSameOrigin(req, env, opts.rawBody);
      return await fn(req, env, ((await ctx?.params) ?? {}) as P);
    } catch (e) {
      if (e instanceof HttpError) return jsonResponse({ error: e.message, code: e.code }, e.status);
      // A duplicate key (two records claiming the same ID) is a conflict, not a server fault.
      if (String(e).includes("UNIQUE constraint failed")) return jsonResponse({ error: "That record already exists.", code: "duplicate" }, 409);
      console.error("Unhandled API error", e);
      return jsonResponse({ error: "Something went wrong." }, 500);
    }
  };
}

/** Simple fixed-window rate limit stored in D1. Returns false when the limit is exceeded. */
export async function rateLimit(db: Db, key: string, max: number, windowMinutes: number) {
  const t = now();
  const row = await one<{ count: number; window_start: string }>(db, "SELECT count, window_start FROM rate_limits WHERE key = ?", key);
  if (!row || addMinutes(row.window_start, windowMinutes) < t) {
    await run(db, "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start", key, t);
    return true;
  }
  if (row.count >= max) return false;
  await run(db, "UPDATE rate_limits SET count = count + 1 WHERE key = ?", key);
  return true;
}
