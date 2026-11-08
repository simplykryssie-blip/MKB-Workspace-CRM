/**
 * Automatic client emails: loads the saved wording, renders the branded
 * layout and sends (or writes to the outbox when no email key is set).
 * Server-only.
 */
import { EMAIL_TEMPLATES, renderEmail, wordingFor, WORDING_FIELDS, type EmailWording, type TemplateKey } from "@/lib/email/templates";
import { badRequest, json, now, one, run, type AppEnv } from "./core";
import { audit, requirePermission, sendEmail, type Actor, type EmailAttachment } from "./identity";

/** Images in emails must come from a public address (the app itself is behind sign-in). */
export function publicAssetOrigin(env: AppEnv) {
  const host = (env.WEBSITE_HOSTS ?? "").split(",").map((x) => x.trim()).find((h) => h.startsWith("www.")) ?? "www.mkbfinancialgroup.com";
  return `https://${host}`;
}
export const portalUrl = (env: AppEnv) => `${env.APP_ORIGIN ?? "https://app.mkbfinancialgroup.com"}/portal`;

export async function loadWording(env: AppEnv, key: TemplateKey) {
  const r = await one<{ data: string; updated_at: string; updated_by: string | null }>(env.DB, "SELECT data, updated_at, updated_by FROM email_templates WHERE key = ?", key).catch(() => null);
  return { wording: wordingFor(key, r ? json<Partial<EmailWording>>(r.data, {}) : null), updatedAt: r?.updated_at, updatedBy: r?.updated_by ?? undefined, custom: !!r };
}

export async function sendTemplate(env: AppEnv, key: TemplateKey, m: { to: string; vars: Record<string, string>; documents?: string[]; attachments?: EmailAttachment[] }) {
  const { wording } = await loadWording(env, key);
  const e = renderEmail({ wording, docsTitle: EMAIL_TEMPLATES[key].docsTitle, vars: m.vars, documents: m.documents, buttonUrl: portalUrl(env), logoUrl: `${publicAssetOrigin(env)}/brand/mkb-seal-192.png` });
  return sendEmail(env, { to: m.to, template: key, subject: e.subject, text: e.text, html: e.html, attachments: m.attachments });
}

/* ---------------------------------------------------------------- Settings */
export async function listTemplates(env: AppEnv, a: Actor) {
  requirePermission(a, "settings", "view");
  const keys = Object.keys(EMAIL_TEMPLATES) as TemplateKey[];
  return { templates: await Promise.all(keys.map(async (k) => ({ key: k, ...(await loadWording(env, k)) }))) };
}

export async function saveTemplate(env: AppEnv, a: Actor, key: string, b: { wording?: Partial<EmailWording>; reset?: boolean }) {
  requirePermission(a, "settings", "settings");
  if (a.kind !== "staff") throw badRequest("Staff only.");
  if (!(key in EMAIL_TEMPLATES)) throw badRequest("Unknown email.");
  if (b.reset) {
    await run(env.DB, "DELETE FROM email_templates WHERE key = ?", key);
  } else {
    const w: Partial<EmailWording> = {};
    for (const f of WORDING_FIELDS) {
      const v = b.wording?.[f.key];
      if (typeof v !== "string") continue;
      const max = f.key === "steps" ? 2000 : f.long ? 1000 : 200;
      if (v.length > max) throw badRequest(`${f.label} is too long.`);
      w[f.key] = v.replace(/\r/g, "");
    }
    if (!w.subject?.trim() || !w.heading?.trim()) throw badRequest("The subject and heading can't be empty.");
    await run(env.DB, "INSERT INTO email_templates (key, data, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by", key, JSON.stringify(w), now(), a.member.id);
  }
  await audit(env.DB, a, { action: "Record update", resource: `Email template — ${EMAIL_TEMPLATES[key as TemplateKey].name}`, meta: b.reset ? "Reset to default" : "Wording changed" });
  return loadWording(env, key as TemplateKey);
}
