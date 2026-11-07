#!/usr/bin/env node
/**
 * Builds and deploys the protected preview (Worker "mkb-crm-preview").
 *
 *   node scripts/deploy-preview.mjs [--secrets-file path.json] [--skip-build]
 *
 * The page files (scripts, styles, images) are put in their own R2 bucket and
 * served by a small wrapper around the OpenNext worker, instead of Workers
 * Static Assets. Static Assets needs a one-time upload pass that this
 * development environment's network proxy replaces with the API token. The live
 * Worker (top level of wrangler.jsonc) is not affected by this script.
 *
 * Needs a Cloudflare API token with Workers Scripts, D1 and R2 edit access
 * (CLOUDFLARE_API_TOKEN). No secrets are printed.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const ASSETS = join(ROOT, ".open-next/assets");
const STATIC_BUCKET = "mkb-crm-static-preview";
const args = process.argv.slice(2);
const secretsFile = args.includes("--secrets-file") ? args[args.indexOf("--secrets-file") + 1] : null;

const config = JSON.parse(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
const preview = config.env?.preview;
if (!preview?.d1_databases?.[0]?.database_id) throw new Error("env.preview is not configured — run scripts/provision-preview.sh first.");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? config.account_id ?? "d21efb365208814b254e302c87342096";
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("Set CLOUDFLARE_API_TOKEN.");

// 1. Build with the backend switched on.
if (!args.includes("--skip-build")) {
  execFileSync("npx", ["opennextjs-cloudflare", "build"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_BACKEND: "1" } });
}

// 2. Upload page files to their own bucket.
const TYPES = {
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".map": "application/json", ".txt": "text/plain; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".ico": "image/x-icon", ".avif": "image/avif",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".webmanifest": "application/manifest+json",
};
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
// Stored under a hash of the path: Cloudflare's API firewall refuses some Next.js
// file paths (e.g. "[...section]") in upload URLs.
const files = walk(ASSETS).map((p) => {
  const key = relative(ASSETS, p).split("\\").join("/");
  return { path: p, key, id: createHash("sha256").update(key).digest("hex").slice(0, 40) };
});
const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${STATIC_BUCKET}/objects/`;
try {
  execFileSync("npx", ["wrangler", "r2", "bucket", "create", STATIC_BUCKET], { cwd: ROOT, stdio: "ignore" });
} catch { /* already exists */ }
// Files are stored gzip-compressed: smaller, and Cloudflare's firewall doesn't
// mistake script contents in an upload for an attack.
const GZ = join(ROOT, ".open-next/.gz");
let n = 0;
for (const f of files) {
  const gz = join(GZ, f.key);
  mkdirSync(dirname(gz), { recursive: true });
  writeFileSync(gz, gzipSync(readFileSync(f.path), { level: 9 }));
  const type = TYPES[extname(f.key).toLowerCase()] ?? "application/octet-stream";
  let ok = false;
  for (let attempt = 0; attempt < 5 && !ok; attempt++) {
    if (attempt) execFileSync("sleep", [String(2 ** attempt)]);
    const out = execFileSync("curl", ["-sS", "-g", "-X", "PUT", "-H", `Authorization: Bearer ${token}`, "-H", `content-type: ${type}`,
      "--data-binary", `@${gz}`, base + "a/" + f.id], { encoding: "utf8" });
    try { ok = JSON.parse(out).success === true; } catch { ok = false; }
  }
  if (!ok) throw new Error(`Upload failed for ${f.key}`);
  if (++n % 25 === 0) console.log(`  uploaded ${n}/${files.length} page files`);
}
console.log(`Uploaded ${files.length} page files to R2 bucket ${STATIC_BUCKET}.`);

// 3. Wrapper worker: serves those files, and stands in for the ASSETS binding.
const keys = Object.fromEntries(files.map((f) => [f.key, "a/" + f.id]));
writeFileSync(join(ROOT, ".open-next/preview-entry.mjs"), `import worker from "./worker.js";
export * from "./worker.js";
const KEYS = new Map(Object.entries(${JSON.stringify(keys)}));
async function serve(env, url, method, internal = false) {
  let key;
  try { key = decodeURIComponent(url.pathname).replace(/^\\/+/, ""); } catch { return null; }
  const id = KEYS.get(key);
  if (!id) return null;
  const obj = await env.STATIC.get(id);
  if (!obj) return null;
  const h = new Headers({
    vary: "accept-encoding",
    "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
    "cache-control": key.startsWith("_next/static/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    etag: obj.httpEtag,
    "x-content-type-options": "nosniff",
  });
  if (method === "HEAD") return new Response(null, { headers: h });
  // Stored gzip-compressed. Browsers get it as is; internal callers get plain bytes.
  if (internal) return new Response(obj.body.pipeThrough(new DecompressionStream("gzip")), { headers: h });
  h.set("content-encoding", "gzip");
  return new Response(obj.body, { headers: h, encodeBody: "manual" });
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" || request.method === "HEAD") {
      const r = await serve(env, url, request.method);
      if (r) return r;
    }
    const ASSETS = {
      async fetch(input, init) {
        const req = new Request(input, init);
        return (await serve(env, new URL(req.url), req.method, true)) ?? new Response("Not found", { status: 404 });
      },
    };
    return worker.fetch(request, { ...env, ASSETS }, ctx);
  },
};
`);

// 4. Deploy configuration for the preview only (no Static Assets, no rebuild step).
const deployConfig = {
  name: preview.name,
  main: "preview-entry.mjs",
  account_id: accountId,
  compatibility_date: config.compatibility_date,
  compatibility_flags: config.compatibility_flags,
  workers_dev: true,
  preview_urls: false,
  d1_databases: preview.d1_databases.map(({ migrations_dir, ...d }) => d),
  r2_buckets: [...preview.r2_buckets, { binding: "STATIC", bucket_name: STATIC_BUCKET }],
  vars: preview.vars,
};
writeFileSync(join(ROOT, ".open-next/wrangler.preview.json"), JSON.stringify(deployConfig, null, 2));
const deployArgs = ["wrangler", "deploy", "-c", ".open-next/wrangler.preview.json"];
if (secretsFile) deployArgs.push("--secrets-file", secretsFile);
execFileSync("npx", deployArgs, { cwd: ROOT, stdio: "inherit" });
