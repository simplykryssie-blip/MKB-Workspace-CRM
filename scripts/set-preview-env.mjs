// Adds/updates the "preview" environment in wrangler.jsonc with the real
// database ID and bucket (a separate Worker, so the live site is untouched).
import fs from "node:fs";
const [id, db, bucket] = process.argv.slice(2);
const path = new URL("../wrangler.jsonc", import.meta.url);
const text = fs.readFileSync(path, "utf8");
// wrangler.jsonc allows comments; strip them to parse, then write clean JSON back.
const cfg = JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""));
cfg.env = cfg.env ?? {};
cfg.env.preview = {
  name: "mkb-crm-preview",
  d1_databases: [{ binding: "DB", database_name: db, database_id: id, migrations_dir: "migrations" }],
  r2_buckets: [{ binding: "FILES", bucket_name: bucket }],
  vars: { APP_ENV: "production", BACKEND_ENABLED: "true" },
};
fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
console.log("wrangler.jsonc: preview environment ->", db, id, bucket);
