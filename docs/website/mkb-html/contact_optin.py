"""Adds the optional marketing opt-in (email + text) to the website Contact form, just before its consent box."""
import json, subprocess, sys, os
env = sys.argv[1]  # local | preview | production
args = ["npx", "wrangler", "d1", "execute", "DB", "--json", "--command", "select fields from forms where slug='contact'"]
args += ["--local"] if env == "local" else ["--env", env, "--remote", "-y"]
e = dict(os.environ, CLOUDFLARE_API_TOKEN="proxy-injected", CLOUDFLARE_ACCOUNT_ID="d21efb365208814b254e302c87342096")
out = subprocess.run(args, capture_output=True, text=True, env=e, cwd="/home/user/mkb-workspace-crm").stdout
fields = json.loads(json.loads(out)[0]["results"][0]["fields"])
if any(f["type"] == "marketing" for f in fields): print("already has opt-in"); sys.exit(0)
opt = {"id": "fld-webmkt", "type": "marketing", "label": "Yes — send me tips, deadline reminders and offers from MKB Financial Group by email and text. Message frequency varies; message and data rates may apply. Reply STOP to opt out of texts.", "map": "none"}
i = next((k for k, f in enumerate(fields) if f["type"] == "consent"), len(fields))
fields.insert(i, opt)
sql = "UPDATE forms SET fields = '" + json.dumps(fields).replace("'", "''") + "', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slug = 'contact';"
path = f"/tmp/claude-0/-home-user/e2ffa75b-131c-53f3-af18-84dac338c569/scratchpad/site/contact-optin-{env}.sql"
open(path, "w").write(sql)
args2 = ["npx", "wrangler", "d1", "execute", "DB", "--file", path] + (["--local"] if env == "local" else ["--env", env, "--remote", "-y"])
r = subprocess.run(args2, capture_output=True, text=True, env=e, cwd="/home/user/mkb-workspace-crm")
print(env, "updated" if r.returncode == 0 else r.stderr[-300:])
