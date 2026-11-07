#!/usr/bin/env bash
# Creates the PROTECTED PREVIEW backend on Cloudflare (never touches the live site):
#   - D1 database  mkb-crm-preview
#   - R2 bucket    mkb-crm-files-preview
#   - applies all database migrations
#   - generates the encryption key and stores it as a Worker secret
# Needs a Cloudflare API token (D1 Edit, Workers R2 Storage Edit, Workers Scripts Edit,
# Account Settings Read). Safe to re-run: existing resources are reused.
# It does NOT deploy the app and does NOT load any sample or client data.
set -euo pipefail
cd "$(dirname "$0")/.."
KEY_COPY="${1:?usage: provision-preview.sh <file to write the encryption-key copy to>}"
DB=mkb-crm-preview
BUCKET=mkb-crm-files-preview
W="npx wrangler"

echo "== Account"
$W whoami

echo "== Database"
ID=$($W d1 list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).find(x=>x.name==='$DB');process.stdout.write(d?d.uuid:'')})")
if [ -z "$ID" ]; then
  $W d1 create "$DB" --location enam >/dev/null
  ID=$($W d1 list --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).find(x=>x.name==='$DB').uuid))")
fi
echo "database_id: $ID"

echo "== File storage"
$W r2 bucket list 2>/dev/null | grep -q "name: *$BUCKET" || $W r2 bucket create "$BUCKET"

echo "== Preview settings in wrangler.jsonc"
node scripts/set-preview-env.mjs "$ID" "$DB" "$BUCKET"

echo "== Migrations (remote preview database)"
$W d1 migrations apply DB --env preview --remote

echo "== Encryption key"
# Cloudflare keeps secrets on the Worker itself, so the key can only be attached once the
# preview Worker exists (it is uploaded together with the first preview deploy).
if $W secret list --env preview 2>/dev/null | grep -q ENCRYPTION_KEY; then
  echo "ENCRYPTION_KEY already set on the preview Worker — not replaced (that would make encrypted data unreadable)."
else
  if [ ! -s "$KEY_COPY" ]; then
    umask 077
    node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" > "$KEY_COPY"
    echo "New encryption key generated: $KEY_COPY"
  else
    echo "Reusing the encryption key already generated in $KEY_COPY"
  fi
  if $W secret put ENCRYPTION_KEY --env preview < "$KEY_COPY" >/dev/null 2>&1; then
    printf '1' | $W secret put ENCRYPTION_KEY_VERSION --env preview >/dev/null
    echo "Key stored as a Cloudflare secret on the preview Worker."
  else
    echo "Preview Worker doesn't exist yet: the key will be attached with the first preview deploy."
  fi
fi
echo "Done. Nothing was deployed."
