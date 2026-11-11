/**
 * Campaigns (marketing email; texts come in a later phase) — shared by the
 * staff screens and the server.
 */
export type Brand = "mkb" | "monarch";
export const BRANDS: Record<Brand, { label: string; site: string }> = {
  mkb: { label: "MKB Financial Group", site: "https://www.mkbfinancialgroup.com" },
  monarch: { label: "Monarch Tax Suite", site: "https://www.monarchtaxsuite.com" },
};

/** Who a campaign goes to. Empty lists mean "any". */
export type Filters = {
  leads?: { on: boolean; statuses?: string[]; stages?: string[]; tags?: string[]; services?: string[] };
  clients?: { on: boolean; statuses?: string[]; services?: string[]; tags?: string[] };
  offices?: { on: boolean; stages?: string[] };
  resellers?: { on: boolean };
  /** Two-letter states (from the contact's address). */
  states?: string[];
};
export const DEFAULT_FILTERS: Record<Brand, Filters> = {
  mkb: { leads: { on: true, statuses: ["open"] }, clients: { on: false } },
  monarch: { offices: { on: true }, resellers: { on: false } },
};

/** The email: written in plain words; blank lines start new paragraphs, "- " starts a bullet, **bold**. */
export type Content = { subject: string; preheader?: string; heading?: string; body: string; buttonLabel?: string; buttonUrl?: string; image?: string };
export const EMPTY_CONTENT: Content = { subject: "", preheader: "", heading: "", body: "", buttonLabel: "", buttonUrl: "", image: "" };

/** Personal fill-ins: {first name}, {name}, {business name}. */
export const FILL_INS = ["first name", "name", "business name"] as const;
export const fillIn = (t: string, vars: Record<string, string>) => t.replace(/\{([a-z ]+)\}/gi, (whole, k: string) => (k.trim().toLowerCase() in vars ? vars[k.trim().toLowerCase()] : whole));

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";
export const STATUS_LABEL: Record<CampaignStatus, string> = { draft: "Draft", scheduled: "Scheduled", sending: "Sending", sent: "Sent", cancelled: "Cancelled" };

export type Campaign = {
  id: string; brand: Brand; channel: "email"; name: string; content: Content; filters: Filters; status: CampaignStatus;
  scheduledAt?: string; startedAt?: string; finishedAt?: string; createdAt: string; createdBy?: string; sentBy?: string; updatedAt: string; rev: number;
  stats?: { total: number; queued: number; sent: number; failed: number; skipped: number; opened: number; clicked: number; unsubscribed: number };
};
export type CampaignSettings = { brand: Brand; fromName: string; fromEmail: string; replyTo: string; mailingAddress: string; dailyLimit: number; reserve: number };

export const LEAD_STATUSES = [["open", "Open"], ["lost", "Lost"], ["converted", "Became a client"]] as const;
export const CLIENT_STATUSES = [["active", "Active"], ["onboarding", "Onboarding"], ["inactive", "Inactive"]] as const;
export const SERVICE_OPTIONS = [["tax", "Tax"], ["books", "Bookkeeping & payroll"], ["biz", "Business Solutions"], ["expunge", "Record Relief"]] as const;
export const OFFICE_STAGES = [["interested", "Interested (sign-ups & forms)"], ["paid", "Paid"], ["collecting", "Collecting info"], ["setup", "In setup"], ["active", "Active"], ["inactive", "Inactive"]] as const;

/* ---------------------------------------------------------------- rendering (shared with the live preview) */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const inline = (s: string) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" style="color:#8a5f1d">$1</a>');

/** Paragraphs and bullet lists from plain text. */
function bodyHtml(body: string) {
  return body.split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return "";
    if (lines.every((l) => /^[-•]\s+/.test(l))) return `<ul style="margin:0 0 14px;padding-left:20px">${lines.map((l) => `<li style="margin:0 0 6px">${inline(l.replace(/^[-•]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p style="margin:0 0 14px">${lines.map(inline).join("<br>")}</p>`;
  }).join("");
}

export type RenderOpts = {
  brand: Brand; content: Content; vars: Record<string, string>; settings: Pick<CampaignSettings, "fromName" | "mailingAddress">;
  logoUrl: string; unsubscribeUrl: string; openPixelUrl?: string; trackLink?: (url: string) => string; reason?: string;
};
export function renderCampaign(o: RenderOpts) {
  const c = o.content;
  const f = (s?: string) => fillIn(s ?? "", o.vars);
  const track = o.trackLink ?? ((u: string) => u);
  const body = bodyHtml(f(c.body)).replace(/href="(https?:\/\/[^"]+)"/g, (_m, u: string) => `href="${esc(track(u.replace(/&amp;/g, "&")))}"`);
  const btn = c.buttonLabel && c.buttonUrl ? `<p style="text-align:center;margin:24px 0 8px"><a href="${esc(track(c.buttonUrl))}" style="display:inline-block;background:#b87912;color:#111111;font-weight:bold;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;padding:13px 22px;text-decoration:none;border-radius:4px">${esc(f(c.buttonLabel))}</a></p>` : "";
  const logo = o.brand === "monarch"
    ? `<img src="${esc(o.logoUrl)}" width="240" alt="Monarch Tax Suite" style="display:block;border:0;max-width:100%;height:auto">`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="${esc(o.logoUrl)}" width="52" height="52" alt="MKB Financial Group" style="display:block;border:0"></td><td style="padding-left:14px"><div style="font:600 18px Georgia,serif;color:#ffffff">MKB Financial Group</div><div style="font-size:10px;letter-spacing:3px;color:#f6d37a;font-weight:bold">STRATEGY • GROWTH • LEGACY</div></td></tr></table>`;
  const reason = o.reason ?? `You're receiving this because you're in touch with ${o.settings.fromName}.`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(f(c.subject))}</title></head><body style="margin:0;background:#eceae4;font-family:Arial,Helvetica,sans-serif;color:#111">
${c.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(f(c.preheader))}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceae4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0b0b0b;padding:20px 24px">${logo}</td></tr>
<tr><td style="height:4px;background:#b87912;background-image:linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)"></td></tr>
${c.image ? `<tr><td><img src="${esc(c.image)}" width="600" alt="" style="display:block;width:100%;height:auto;border:0"></td></tr>` : ""}
<tr><td style="padding:26px 24px;font-size:15px;line-height:1.6">
${c.heading ? `<h1 style="font:500 26px/1.2 Georgia,serif;margin:0 0 14px">${esc(f(c.heading))}</h1>` : ""}
${body}${btn}
</td></tr>
<tr><td style="background:#0b0b0b;color:#aaaaaa;font-size:12px;padding:16px 24px;line-height:1.6"><b style="color:#f6d37a">${esc(o.settings.fromName)}</b><br>${esc(o.settings.mailingAddress).replace(/\n/g, "<br>")}<br><br>${esc(reason)} <a href="${esc(o.unsubscribeUrl)}" style="color:#f6d37a">Unsubscribe</a></td></tr>
</table></td></tr></table>${o.openPixelUrl ? `<img src="${esc(o.openPixelUrl)}" width="1" height="1" alt="" style="display:block;border:0">` : ""}</body></html>`;
  const text = [
    ...(c.heading ? [f(c.heading), ""] : []), f(c.body), "",
    ...(c.buttonLabel && c.buttonUrl ? [`${f(c.buttonLabel)}: ${c.buttonUrl}`, ""] : []),
    "—", o.settings.fromName, o.settings.mailingAddress, "", `${reason} Unsubscribe: ${o.unsubscribeUrl}`,
  ].join("\n");
  return { subject: f(c.subject), html, text };
}
