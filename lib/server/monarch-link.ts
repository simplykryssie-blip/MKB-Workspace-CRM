/**
 * Monarch: the office's private upload link (no login) and the emails staff
 * send an office. The link is a long random token; only its SHA-256 hash is
 * stored. It works for one office only, stops after N days without use, is
 * replaced whenever a new one is sent, and can be turned off at any time.
 * Server-only.
 */
import { addMinutes, all, badRequest, HttpError, json, notFound, now, one, rateLimit, run, str, type AppEnv } from "./core";
import { randomId, randomToken, sha256 } from "./crypto";
import { audit, type Actor } from "./identity";
import { notify } from "./notifications";
import { linkOrigin } from "./books-intake";
import { signatureFrom } from "./signature";
import { buildMonarchAgreementPdf } from "./intake-pdf";
import { fillIn, sendMonarch } from "./monarch-email";
import { advance, itemsFor, linkState, loadSettings, matchRowsToOffice, need, note, officeEfins, officeRow, officeView, sanitizeLocations, sanitizePreparers, staffId, type OfficeRow } from "./monarch";
import { capacity, isDone, itemState, type ItemState, type Location } from "@/lib/monarch/types";

const linkUrl = (env: AppEnv, token: string) => `${linkOrigin(env)}/i/m/${token}`;

/* ---------------------------------------------------------------- staff: link */
/** Creates a new link (the old one stops working). Emails it unless `copyOnly`. Returns the address once. */
export async function sendLink(env: AppEnv, a: Actor, id: string, b: { copyOnly?: unknown }) {
  need(a, "edit");
  const r = await officeRow(env, id);
  const s = await loadSettings(env);
  const copyOnly = !!b.copyOnly;
  if (!copyOnly && !r.email) throw badRequest("Add the office's email address first.");
  const token = randomToken(32);
  const t = now();
  await run(env.DB, "UPDATE mon_offices SET link_hash = ?, link_sent_at = ?, link_last_used = NULL, link_expires_at = ?, link_off_at = NULL, updated_at = ?, rev = rev + 1 WHERE id = ?", await sha256(token), t, addMinutes(t, s.linkDays * 1440), t, id);
  const url = linkUrl(env, token);
  let emailed = false;
  if (!copyOnly) {
    const { items } = await itemsFor(env, r);
    const o = { checklist: json<Record<string, ItemState>>(r.checklist, {}) };
    const open = items.filter((i) => i.who === "office" && !isDone(itemState(o, i.key))).map((i) => i.label);
    const first = r.contact_name.split(" ")[0] || "there";
    const res = await sendMonarch(env, s, {
      to: r.email, template: "monarch_upload_link",
      subject: open.length ? `${r.name}: let's get your office set up with Monarch` : `${r.name}: your Monarch setup link`,
      heading: `Hi ${first} — let's get ${r.name} set up.`,
      paragraphs: ["Use your private link below to sign your service bureau agreement and send us what we need. It saves as you go, so you can come back to it anytime."],
      list: open.length ? { title: "What we still need", items: open } : undefined,
      button: { label: "Open your setup link", url },
      after: [`This link is only for ${r.name}. It stops working after ${s.linkDays} days without use — just ask us for a new one.`],
    });
    emailed = res.sent;
  }
  await advance(env, id, { linkSent: true });
  await note(a, `Office ${r.name}`, copyOnly ? "New upload link created (copied)" : `Upload link emailed to ${r.email}`, env);
  return { url, emailed, office: await officeView(env, id) };
}

export async function linkOff(env: AppEnv, a: Actor, id: string) {
  need(a, "edit");
  const r = await officeRow(env, id);
  await run(env.DB, "UPDATE mon_offices SET link_off_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", now(), now(), id);
  await note(a, `Office ${r.name}`, "Upload link turned off", env);
  return { office: await officeView(env, id) };
}

/* ---------------------------------------------------------------- staff: emails */
export async function sendBankApp(env: AppEnv, a: Actor, id: string) {
  need(a, "edit");
  const r = await officeRow(env, id);
  const { bank } = await itemsFor(env, r);
  if (!bank) throw badRequest("Choose the office's bank first.");
  if (!bank.applicationUrl) throw badRequest(`Add the ${bank.name} application link in Setup first.`);
  if (!r.email) throw badRequest("Add the office's email address first.");
  const s = await loadSettings(env);
  const first = r.contact_name.split(" ")[0] || "there";
  const res = await sendMonarch(env, s, {
    to: r.email, template: "monarch_bank_application",
    subject: `${r.name}: your ${bank.name} bank product application`,
    heading: `Hi ${first} — here's your ${bank.name} application.`,
    paragraphs: [`To offer bank products this season, ${r.name} needs to enroll with ${bank.name}. Fill out the application at the link below.`, "When you're done, upload a copy of your completed application through your Monarch setup link so we can check it."],
    button: { label: `Open the ${bank.name} application`, url: bank.applicationUrl },
  });
  const cl = json<Record<string, ItemState>>(r.checklist, {});
  cl.bank_app = { ...(cl.bank_app ?? { status: "open" }), sentAt: now() };
  await run(env.DB, "UPDATE mon_offices SET checklist = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(cl), now(), id);
  await note(a, `Office ${r.name}`, `${bank.name} application link emailed`, env);
  return { emailed: res.sent, office: await officeView(env, id) };
}

export const DEFAULT_WELCOME = `Hi {contact name},

{office name} is set up on {software} for the season.

Download: {download link}
Username: {username}

Your password comes separately on our setup call.`;

export async function sendWelcome(env: AppEnv, a: Actor, id: string) {
  need(a, "edit");
  const r = await officeRow(env, id);
  const { software } = await itemsFor(env, r);
  if (!software) throw badRequest("Choose the office's software first.");
  if (!r.software_username.trim()) throw badRequest("Record their software username first.");
  if (!r.email) throw badRequest("Add the office's email address first.");
  const s = await loadSettings(env);
  const vars = { "contact name": r.contact_name.split(" ")[0] || r.name, "office name": r.name, software: software.name, "download link": software.downloadUrl || "(we'll send the download link separately)", username: r.software_username };
  const body = fillIn(software.welcomeBody.trim() || DEFAULT_WELCOME, vars);
  const res = await sendMonarch(env, s, {
    to: r.email, template: "monarch_software_welcome",
    subject: fillIn(software.welcomeSubject.trim() || `${r.name} is set up on {software}`, vars),
    heading: `Welcome to ${software.name}`,
    paragraphs: body.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean),
    button: software.downloadUrl ? { label: "Download the software", url: software.downloadUrl } : undefined,
  });
  const cl = json<Record<string, ItemState>>(r.checklist, {});
  cl.welcome = { status: "done", at: now(), by: staffId(a), sentAt: now() };
  await run(env.DB, "UPDATE mon_offices SET checklist = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(cl), now(), id);
  await advance(env, id);
  await note(a, `Office ${r.name}`, `${software.name} welcome email sent`, env);
  return { emailed: res.sent, office: await officeView(env, id) };
}

/* ---------------------------------------------------------------- files */
const TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp", gif: "image/gif", tif: "image/tiff", tiff: "image/tiff", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", txt: "text/plain" };
const MAX = 25 * 1024 * 1024;

async function storeFile(env: AppEnv, req: Request, officeId: string, item: string, by: string) {
  const name = decodeURIComponent(req.headers.get("x-file-name") ?? "").replace(/[\r\n"\\/]/g, "").trim().slice(0, 150);
  const ext = (name.includes(".") ? name.split(".").pop()! : "").toLowerCase();
  const type = TYPES[ext];
  if (!name || !type) throw badRequest("That file type isn't supported. Use a PDF, a photo, Word or Excel.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) throw badRequest("That file is empty.");
  if (bytes.length > MAX) throw new HttpError(413, "That file is larger than 25 MB.");
  const id = randomId("mf");
  const key = `monarch/${officeId}/${id}.${ext}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: type }, customMetadata: { uploadedBy: by, originalName: name } });
  await run(env.DB, "INSERT INTO mon_files (id, office_id, item, r2_key, name, content_type, size_bytes, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", id, officeId, item, key, name, type, bytes.length, by, now());
  return { id, name, sizeKb: Math.max(1, Math.round(bytes.length / 1024)) };
}

/** Staff upload for a checklist item (counts as done). */
export async function staffUploadFile(env: AppEnv, a: Actor, req: Request, id: string, item: string) {
  need(a, "edit");
  const r = await officeRow(env, id);
  if (!/^[a-z_]{2,30}$/.test(item)) throw badRequest("Invalid item.");
  if (a.kind === "staff" && !(await rateLimit(env.DB, `monup:${a.userId}`, 300, 60))) throw new HttpError(429, "Too many uploads in the last hour.", "rate_limited");
  const f = await storeFile(env, req, id, item, staffId(a));
  const cl = json<Record<string, ItemState>>(r.checklist, {});
  if (item !== "other") cl[item] = { ...(cl[item] ?? {}), status: "done", at: now(), by: staffId(a) };
  await run(env.DB, "UPDATE mon_offices SET checklist = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(cl), now(), id);
  await advance(env, id);
  await note(a, `Office ${r.name}`, `Uploaded ${f.name}`, env);
  return { office: await officeView(env, id) };
}

export async function openFile(env: AppEnv, a: Actor, id: string, fileId: string, inline: boolean) {
  need(a, "view");
  const f = await one<{ r2_key: string; name: string; content_type: string }>(env.DB, "SELECT r2_key, name, content_type FROM mon_files WHERE id = ? AND office_id = ? AND deleted_at IS NULL", fileId, id);
  if (!f) throw notFound("File not found.");
  const obj = await env.FILES.get(f.r2_key);
  if (!obj) throw notFound("The file is missing from storage.");
  await audit(env.DB, a, { action: "Record update", resource: `Monarch — office ${id}`, meta: `Opened ${f.name}` });
  const safeName = f.name.replace(/[^\w.\- ()]/g, "_");
  const showInline = inline && /^(application\/pdf|image\/(jpeg|png|gif|webp))$/.test(f.content_type);
  return new Response(obj.body, { headers: { "content-type": f.content_type, "content-disposition": `${showInline ? "inline" : "attachment"}; filename="${safeName}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" } });
}

export async function deleteFile(env: AppEnv, a: Actor, id: string, fileId: string) {
  need(a, "edit");
  const r = await officeRow(env, id);
  const f = await one<{ r2_key: string; name: string }>(env.DB, "SELECT r2_key, name FROM mon_files WHERE id = ? AND office_id = ? AND deleted_at IS NULL", fileId, id);
  if (!f) throw notFound("File not found.");
  await run(env.DB, "UPDATE mon_files SET deleted_at = ? WHERE id = ?", now(), fileId);
  await env.FILES.delete(f.r2_key).catch(() => {});
  await note(a, `Office ${r.name}`, `Removed ${f.name}`, env);
  return { office: await officeView(env, id) };
}

/* ---------------------------------------------------------------- public link */
const GONE = "This link is no longer active. Please contact Monarch Tax Suite for a new one.";

async function openOffice(env: AppEnv, token: string, ip: string) {
  if (!(await rateLimit(env.DB, `monlink:${ip}`, 300, 10))) throw new HttpError(429, "Too many requests. Please wait a few minutes and try again.", "rate_limited");
  const miss = await one<{ count: number; window_start: string }>(env.DB, "SELECT count, window_start FROM rate_limits WHERE key = ?", `monmiss:${ip}`);
  if (miss && miss.count >= 20 && addMinutes(miss.window_start, 60) > now()) throw new HttpError(429, "Too many invalid links from this connection. Please wait an hour and try again.", "rate_limited");
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new HttpError(404, "This link isn't valid. Please check that you copied the whole link from your email.", "not_found");
  const r = await one<OfficeRow>(env.DB, "SELECT * FROM mon_offices WHERE link_hash = ?", await sha256(token));
  if (!r) { await rateLimit(env.DB, `monmiss:${ip}`, 20, 60); throw new HttpError(404, "This link isn't valid. Please check that you copied the whole link from your email.", "not_found"); }
  const st = linkState(r);
  if (st === "expired") throw new HttpError(410, "This link expired because it wasn't used for a while. Please contact Monarch Tax Suite for a new one.", "expired");
  if (st !== "on") throw new HttpError(410, GONE, "off");
  return r;
}

/** Each use pushes the expiry out again. */
async function touch(env: AppEnv, r: OfficeRow) {
  const s = await loadSettings(env);
  const t = now();
  await run(env.DB, "UPDATE mon_offices SET link_last_used = ?, link_expires_at = ? WHERE id = ?", t, addMinutes(t, s.linkDays * 1440), r.id);
}

export async function publicView(env: AppEnv, token: string, ip: string) {
  const r = await openOffice(env, token, ip);
  await touch(env, r);
  return viewFor(env, (await officeRow(env, r.id)));
}

async function viewFor(env: AppEnv, r: OfficeRow) {
  const s = await loadSettings(env);
  const { items, pkg, bank } = await itemsFor(env, r);
  const cl = json<Record<string, ItemState>>(r.checklist, {});
  const files = await all<{ id: string; item: string; name: string; created_at: string }>(env.DB, "SELECT id, item, name, created_at FROM mon_files WHERE office_id = ? AND deleted_at IS NULL AND uploaded_by = 'office' ORDER BY created_at", r.id);
  const locations = json<Location[]>(r.locations, []);
  const cap = capacity({ locations, extraLocations: r.extra_locations, extraSeats: r.extra_seats } as never, pkg);
  const ag = json<{ name: string; at: string } | null>(r.agreement, null);
  return {
    office: { name: r.name, contactName: r.contact_name },
    items: items.filter((i) => i.who === "office").map((i) => ({ key: i.key, label: i.label, help: i.help, kind: i.kind, status: (cl[i.key]?.status ?? "open"), note: cl[i.key]?.status === "open" ? cl[i.key]?.note : undefined, files: files.filter((f) => f.item === i.key).map((f) => ({ name: f.name, at: f.created_at })) })),
    locations,
    preparers: pkg?.askPtins ? json(r.preparers, []) : undefined,
    included: { locations: cap.locations, seats: cap.seats },
    agreement: { text: s.agreement.text, version: s.agreement.version, signed: ag ? { name: ag.name, at: ag.at } : undefined },
    bank: bank ? { name: bank.name, applicationUrl: bank.applicationUrl || undefined } : undefined,
    expiresAt: addMinutes(now(), s.linkDays * 1440),
    contact: { phone: s.phone, email: s.email },
  };
}

async function officeChanged(env: AppEnv, r: OfficeRow, ip: string, what: string) {
  await audit(env.DB, { kind: "anonymous", ip }, { action: "Record update", resource: `Monarch — office ${r.id}`, meta: `Through the upload link: ${what}` });
  await notify(env, { module: "monarch" }, { kind: "documents", title: `${r.name}: ${what}`, body: "Sent through their Monarch setup link — review it on the office page.", href: `/monarch/offices/${r.id}` });
  await advance(env, r.id);
}

const officeItem = async (env: AppEnv, r: OfficeRow, key: string, kind: string) => {
  const { items } = await itemsFor(env, r);
  const i = items.find((x) => x.key === key && x.who === "office");
  if (!i || i.kind !== kind) throw badRequest("That item isn't on your list.");
  return i;
};

export async function publicUpload(env: AppEnv, token: string, ip: string, req: Request, item: string) {
  const r = await openOffice(env, token, ip);
  if (!(await rateLimit(env.DB, `monlinkup:${r.id}`, 60, 60))) throw new HttpError(429, "Too many uploads in the last hour. Please wait and try again.", "rate_limited");
  const i = await officeItem(env, r, item, "upload");
  const f = await storeFile(env, req, r.id, item, "office");
  const cl = json<Record<string, ItemState>>(r.checklist, {});
  if (cl[item]?.status !== "done") cl[item] = { ...(cl[item] ?? {}), status: "review", at: now(), by: "office", note: undefined };
  await run(env.DB, "UPDATE mon_offices SET checklist = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(cl), now(), r.id);
  await touch(env, r);
  await officeChanged(env, r, ip, `uploaded ${i.label.toLowerCase()} (${f.name})`);
  return viewFor(env, await officeRow(env, r.id));
}

export async function publicSign(env: AppEnv, token: string, ip: string, b: { name?: unknown; signature?: unknown; version?: unknown }) {
  const r = await openOffice(env, token, ip);
  if (r.agreement) throw badRequest("The agreement is already signed — thank you!");
  const name = str(b.name, 120);
  if (name.length < 3) throw badRequest("Type your full name.");
  const png = signatureFrom(b.signature);
  const s = await loadSettings(env);
  if (Number(b.version) !== s.agreement.version) throw new HttpError(409, "The agreement was just updated. Please read the new version and sign again.", "conflict");
  const t = now();
  const pdf = await buildMonarchAgreementPdf({ officeName: r.name, text: s.agreement.text, version: s.agreement.version, signedName: name, signedAt: t, ip, signaturePng: png });
  const fileId = randomId("mf");
  const key = `monarch/${r.id}/${fileId}.pdf`;
  await env.FILES.put(key, pdf, { httpMetadata: { contentType: "application/pdf" }, customMetadata: { uploadedBy: "office" } });
  const cl = json<Record<string, ItemState>>(r.checklist, {});
  cl.agreement = { status: "done", at: t, by: "office" };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO mon_files (id, office_id, item, r2_key, name, content_type, size_bytes, uploaded_by, created_at) VALUES (?, ?, 'agreement', ?, ?, 'application/pdf', ?, 'office', ?)").bind(fileId, r.id, key, `Service bureau agreement v${s.agreement.version} (signed).pdf`, pdf.length, t),
    env.DB.prepare("UPDATE mon_offices SET agreement = ?, checklist = ?, updated_at = ?, rev = rev + 1 WHERE id = ? AND agreement IS NULL").bind(JSON.stringify({ name, at: t, fileId, version: s.agreement.version }), JSON.stringify(cl), t, r.id),
  ]);
  await touch(env, r);
  await officeChanged(env, r, ip, `signed the service bureau agreement (${name})`);
  return viewFor(env, await officeRow(env, r.id));
}

export async function publicLocations(env: AppEnv, token: string, ip: string, b: { locations?: unknown }) {
  const r = await openOffice(env, token, ip);
  await officeItem(env, r, "locations", "locations");
  const locs = sanitizeLocations(b.locations);
  if (!locs.length) throw badRequest("Add at least one location.");
  if (locs.some((l) => !l.address)) throw badRequest("Add the address for each location.");
  const cl = json<Record<string, ItemState>>(r.checklist, {});
  if (cl.locations?.status !== "done") cl.locations = { status: "review", at: now(), by: "office" };
  await run(env.DB, "UPDATE mon_offices SET locations = ?, checklist = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(locs), JSON.stringify(cl), now(), r.id);
  await matchRowsToOffice(env, r.id, officeEfins({ locations: locs }));
  await touch(env, r);
  await officeChanged(env, r, ip, `sent ${locs.length} office location${locs.length === 1 ? "" : "s"}`);
  return viewFor(env, await officeRow(env, r.id));
}

export async function publicPreparers(env: AppEnv, token: string, ip: string, b: { preparers?: unknown }) {
  const r = await openOffice(env, token, ip);
  await officeItem(env, r, "preparers", "preparers");
  const preps = sanitizePreparers(b.preparers);
  if (!preps.length) throw badRequest("Add at least one preparer.");
  const cl = json<Record<string, ItemState>>(r.checklist, {});
  if (cl.preparers?.status !== "done") cl.preparers = { status: "review", at: now(), by: "office" };
  await run(env.DB, "UPDATE mon_offices SET preparers = ?, checklist = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", JSON.stringify(preps), JSON.stringify(cl), now(), r.id);
  await touch(env, r);
  await officeChanged(env, r, ip, `sent ${preps.length} preparer${preps.length === 1 ? "" : "s"}`);
  return viewFor(env, await officeRow(env, r.id));
}


/* ---------------------------------------------------------------- welcome after purchase */
/**
 * The welcome an office gets as soon as its package is paid (automatic when
 * "Send the welcome automatically" is on in Setup, or sent by staff): their
 * private setup link (agreement, photo ID, business documents, locations and
 * EFINs, preparers), the list of what's needed, and the software and bank
 * applications. Fills in the office's software and bank from the package when
 * they aren't set yet. Safe to call again (a new link replaces the old one).
 */
export async function sendWelcomePackage(env: AppEnv, id: string, a?: Actor) {
  let r = await officeRow(env, id);
  if (!r.email) {
    if (a) throw badRequest("Add the office's email address first.");
    await notify(env, { module: "monarch" }, { kind: "payment", title: `Monarch: ${r.name} paid but has no email`, body: "Add their email, then send the welcome from their office page.", href: `/monarch/offices/${id}` });
    return { emailed: false };
  }
  // Software and bank come from the package when the office doesn't have them yet.
  const pkg = r.package_id ? await one<{ software_id: string | null; bank_id: string | null }>(env.DB, "SELECT software_id, bank_id FROM mon_packages WHERE id = ?", r.package_id) : null;
  if (pkg && ((!r.software_id && pkg.software_id) || (!r.bank_id && pkg.bank_id))) {
    await run(env.DB, "UPDATE mon_offices SET software_id = coalesce(software_id, ?), bank_id = coalesce(bank_id, ?), updated_at = ?, rev = rev + 1 WHERE id = ?", pkg.software_id, pkg.bank_id, now(), id);
    r = await officeRow(env, id);
  }
  const s = await loadSettings(env);
  const { items, bank, software } = await itemsFor(env, r);
  const token = randomToken(32);
  const t = now();
  await run(env.DB, "UPDATE mon_offices SET link_hash = ?, link_sent_at = ?, link_last_used = NULL, link_expires_at = ?, link_off_at = NULL, welcome_sent_at = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", await sha256(token), t, addMinutes(t, s.linkDays * 1440), t, t, id);
  const o = { checklist: json<Record<string, ItemState>>(r.checklist, {}) };
  const open = items.filter((i) => i.who === "office" && !isDone(itemState(o, i.key))).map((i) => i.label);
  const first = r.contact_name.split(" ")[0] || "there";
  const links = [
    ...(software?.applicationUrl ? [{ label: `${software.name} onboarding application`, note: `Fill this out so we can set up ${r.name} on ${software.name}.`, url: software.applicationUrl }] : []),
    ...(bank?.applicationUrl ? [{ label: `${bank.name} bank product application`, note: "Fill it out, then upload a copy of your completed application through your setup link.", url: bank.applicationUrl }] : []),
  ];
  const res = await sendMonarch(env, s, {
    to: r.email, template: "monarch_welcome",
    subject: `Welcome to Monarch Tax Suite — let's get ${r.name} set up`,
    heading: `Welcome, ${first}! Let's get ${r.name} set up.`,
    paragraphs: [
      "Thank you for your purchase. Here's everything we need to get your office ready for the season.",
      "Use your private setup link to sign your service bureau agreement and send us your documents. It saves as you go, so you can come back to it anytime.",
    ],
    list: open.length ? { title: "What we need from you", items: open } : undefined,
    button: { label: "Open your setup link", url: linkUrl(env, token) },
    links,
    after: [
      ...(links.length ? [] : ["We'll send your software and bank applications separately."]),
      "Once we have everything, we'll set up your software account and bank product enrollment and let you know when you're ready to go.",
      `This link is only for ${r.name}. It stops working after ${s.linkDays} days without use — just ask us for a new one.`,
    ],
  });
  if (bank?.applicationUrl) {
    const cl = json<Record<string, ItemState>>((await officeRow(env, id)).checklist, {});
    cl.bank_app = { ...(cl.bank_app ?? { status: "open" }), sentAt: t };
    await run(env.DB, "UPDATE mon_offices SET checklist = ? WHERE id = ?", JSON.stringify(cl), id);
  }
  await advance(env, id, { linkSent: true });
  if (a) await note(a, `Office ${r.name}`, `Welcome emailed to ${r.email}`, env);
  else await audit(env.DB, { kind: "anonymous", ip: "stripe" }, { action: "Record update", resource: `Monarch — Office ${r.name}`, meta: `Welcome emailed automatically after payment${res.sent ? "" : " (queued)"}` }).catch(() => {});
  return { emailed: res.sent };
}

/** Staff: send (or resend) the welcome from the office page. */
export async function sendWelcomeNow(env: AppEnv, a: Actor, id: string) {
  need(a, "edit");
  const out = await sendWelcomePackage(env, id, a);
  return { ...out, office: await officeView(env, id) };
}
