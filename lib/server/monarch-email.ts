/**
 * Monarch Tax Suite emails: the same simple layout as MKB's emails, with the
 * Monarch logo and contact details. Never put EFINs, PTINs, passwords or
 * document contents in an email. Server-only.
 */
import { sendEmail } from "./identity";
import { publicAssetOrigin } from "./email";
import type { AppEnv } from "./core";
import type { MonarchSettings } from "@/lib/monarch/types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type MonarchMail = { to: string; template: string; subject: string; heading: string; paragraphs: string[]; list?: { title: string; items: string[] }; button?: { label: string; url: string }; after?: string[] };

export function renderMonarch(env: AppEnv, s: MonarchSettings, m: MonarchMail) {
  const logo = `${publicAssetOrigin(env)}/brand/monarch-email.png`;
  const contact = [s.phone, s.email].filter(Boolean).join(" · ");
  const p = (t: string) => `<p style="margin:0 0 12px">${esc(t).replace(/\n/g, "<br>")}</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#eceae4;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceae4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:18px 24px"><img src="${esc(logo)}" width="240" alt="Monarch Tax Suite" style="display:block;border:0;max-width:100%;height:auto"></td></tr>
<tr><td style="height:4px;background:#b87912;background-image:linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)"></td></tr>
<tr><td style="padding:26px 24px;font-size:15px;line-height:1.6">
<h1 style="font:500 24px/1.2 Georgia,serif;margin:0 0 12px">${esc(m.heading)}</h1>
${m.paragraphs.map(p).join("")}
${m.list?.items.length ? `<div style="background:#f7f6f2;border:1px solid #e5e1d8;border-radius:10px;padding:14px 16px;margin:16px 0"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a6a2a;font-weight:bold;margin-bottom:6px">${esc(m.list.title)}</div><ul style="margin:0;padding-left:18px">${m.list.items.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>` : ""}
${m.button ? `<p style="text-align:center;margin:24px 0 8px"><a href="${esc(m.button.url)}" style="display:inline-block;background:#b87912;color:#111111;font-weight:bold;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;padding:13px 22px;text-decoration:none;border-radius:4px">${esc(m.button.label)}</a></p>` : ""}
${(m.after ?? []).map((t) => `<p style="font-size:13px;color:#555;margin:12px 0 0">${esc(t).replace(/\n/g, "<br>")}</p>`).join("")}
</td></tr>
<tr><td style="background:#0b0b0b;color:#aaaaaa;font-size:12px;padding:16px 24px;line-height:1.5"><b style="color:#f6d37a">Monarch Tax Suite</b>${contact ? ` · ${esc(contact)}` : ""}<br>We never ask for passwords, SSNs or client tax information by email.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [m.heading, "", ...m.paragraphs.flatMap((x) => [x, ""]), ...(m.list?.items.length ? [`${m.list.title}:`, ...m.list.items.map((d) => `- ${d}`), ""] : []), ...(m.button ? [`${m.button.label}: ${m.button.url}`, ""] : []), ...(m.after ?? []).flatMap((x) => [x, ""]), `Monarch Tax Suite${contact ? ` · ${contact}` : ""}`].join("\n");
  return { subject: m.subject, html, text };
}

export async function sendMonarch(env: AppEnv, s: MonarchSettings, m: MonarchMail) {
  const e = renderMonarch(env, s, m);
  return sendEmail(env, { to: m.to, template: m.template, subject: e.subject, text: e.text, html: e.html });
}

/** Fills {placeholders} in a staff-written email. Unknown ones are left as typed. */
export const fillIn = (t: string, vars: Record<string, string>) => t.replace(/\{([a-z ]+)\}/gi, (whole, k: string) => vars[k.trim().toLowerCase()] ?? whole);
