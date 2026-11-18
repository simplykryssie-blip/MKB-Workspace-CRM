/**
 * Whether a licensed calculator may be shown, and where. Same rules as the Monarch app it replaces:
 * only an active license, only inside its authorized websites (each also allows its www./bare twin).
 * Kept free of other server modules so the middleware can use it.
 */
export type EmbedDecision =
  | { ok: true; allowedHosts: string[]; licenseId: string; years: number[] }
  | { ok: false; reason: "not_found" | "inactive" | "no_domains" | "domain_not_authorized"; allowedHosts: string[]; licenseId?: string };

export const EMBED_ID_PATTERN = /^emb_[A-Za-z0-9_-]{16,64}$/;
const LOOK_ALIKE = ["1lI", "0O"];

/** Other spellings of an id with look-alike characters swapped (used only when the exact id isn't found). */
export function embedIdVariants(id: string, cap = 64): string[] {
  let out: string[][] = [[...id]];
  for (let i = 0; i < id.length; i++) {
    const cls = LOOK_ALIKE.find((k) => k.includes(id[i]));
    if (!cls) continue;
    out = out.flatMap((chars) => [...cls].map((c) => { const next = chars.slice(); next[i] = c; return next; }));
    if (out.length > cap) return [];
  }
  return out.map((c) => c.join("")).filter((v) => v !== id);
}

export function hostFromHeader(value: string | null | undefined): string | null {
  if (!value) return null;
  try { return new URL(value).hostname.toLowerCase(); } catch { return null; }
}

export function allowedHosts(domains: string[]): string[] {
  const hosts = new Set<string>();
  for (const d of domains) { hosts.add(d); hosts.add(d.startsWith("www.") ? d.slice(4) : `www.${d}`); }
  return [...hosts].sort();
}

type LicenseRow = { id: string; status: string; tax_years: string };
export async function decideEmbed(db: D1Database, embedId: string | null, requestHost: string | null): Promise<EmbedDecision> {
  if (!embedId || !EMBED_ID_PATTERN.test(embedId)) return { ok: false, reason: "not_found", allowedHosts: [] };
  let lic = await db.prepare("SELECT id, status, tax_years FROM calc_licenses WHERE embed_id = ?").bind(embedId).first<LicenseRow>();
  if (!lic) {
    const v = embedIdVariants(embedId);
    if (v.length) lic = await db.prepare(`SELECT id, status, tax_years FROM calc_licenses WHERE embed_id IN (${v.map(() => "?").join(",")}) LIMIT 1`).bind(...v).first<LicenseRow>();
  }
  if (!lic) return { ok: false, reason: "not_found", allowedHosts: [] };
  if (lic.status !== "active") return { ok: false, reason: "inactive", allowedHosts: [], licenseId: lic.id };
  const domains = (await db.prepare("SELECT domain FROM calc_domains WHERE license_id = ?").bind(lic.id).all<{ domain: string }>()).results.map((r) => r.domain);
  const hosts = allowedHosts(domains);
  if (!hosts.length) return { ok: false, reason: "no_domains", allowedHosts: [], licenseId: lic.id };
  if (requestHost && !hosts.includes(requestHost)) return { ok: false, reason: "domain_not_authorized", allowedHosts: hosts, licenseId: lic.id };
  let years: number[] = [];
  try { years = JSON.parse(lic.tax_years); } catch { years = []; }
  return { ok: true, allowedHosts: hosts, licenseId: lic.id, years };
}

/** Browsers render the calculator only inside these HTTPS sites. */
export function frameAncestors(d: EmbedDecision): string {
  if (!d.ok && d.reason !== "domain_not_authorized") return "frame-ancestors 'none'";
  return d.allowedHosts.length ? `frame-ancestors ${d.allowedHosts.map((h) => `https://${h}`).join(" ")}` : "frame-ancestors 'none'";
}

export const EMBED_MESSAGES: Record<Exclude<EmbedDecision, { ok: true }>["reason"], string> = {
  not_found: "This calculator embed code is not recognized.",
  inactive: "This calculator license is not active. Please contact Monarch Tax Suite.",
  no_domains: "This calculator license has no authorized website yet. Please contact Monarch Tax Suite.",
  domain_not_authorized: "This website is not authorized to display this calculator.",
};
/** Public reason: only "domain_not_authorized" is told apart, so the id alone reveals nothing about a license. */
export const publicReason = (r: Exclude<EmbedDecision, { ok: true }>["reason"]) => (r === "domain_not_authorized" ? "domain_not_authorized" : "unavailable");
