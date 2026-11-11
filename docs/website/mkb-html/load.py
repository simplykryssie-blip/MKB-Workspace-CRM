import json, os, sys, datetime
S = os.path.dirname(__file__); out = []
t = datetime.datetime.now(datetime.UTC).isoformat()
q = lambda s: "'" + s.replace("'", "''") + "'"
for f in ("founder-headshot","founder-desk-seated","founder-office-folder","founder-standing","founder-reading","mkb-logo-gold","mkb-logo-header"):
    out.append(f"INSERT OR REPLACE INTO website_media (key, content_type, size, name, uploaded_at, site) VALUES ('{f}.webp','image/webp',{os.path.getsize(f'{S}/img/{f}.webp')},'{f}.webp','{t}','mkb');")
for fn in sorted(os.listdir(f"{S}/out")):
    slug = "" if fn == "home.html" else fn[:-5]
    html = open(f"{S}/out/{fn}").read()
    title = html.split("<title>")[1].split("</title>")[0].split(" | ")[0].replace("&amp;", "&")
    out.append(f"INSERT OR IGNORE INTO website_pages (id, site, slug, title, nav, position, draft, updated_at) VALUES ({q('pg-mkb-' + (slug or 'home'))}, 'mkb', {q(slug)}, {q(title)}, 1, 15, '[]', '{t}');")
    out.append(f"UPDATE website_pages SET title = {q(title)} WHERE site = 'mkb' AND slug = {q(slug)} AND slug IN ('financial-management', 'business-services', 'tax-preparation', 'record-expungement');")
    d = q(json.dumps([{"id": "sec-doc-" + (slug or "home"), "type": "document", "html": html}], ensure_ascii=False))
    out.append(f"UPDATE website_pages SET draft = {d} WHERE site = 'mkb' AND slug = {q(slug)} AND deleted_at IS NULL;")
    out.append(f"UPDATE website_pages SET published = draft, published_at = '{t}', rev = rev + 1, updated_at = '{t}' WHERE site = 'mkb' AND slug = {q(slug)} AND deleted_at IS NULL;")
open(f"{S}/{sys.argv[1]}", "w").write("\n".join(out)); print(len(out))
