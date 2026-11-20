/**
 * Contact names from intakes. A lead often arrives with just a first name ("Wyatt") or a
 * placeholder ("Text from 337-…"); when an intake gives the full legal name that contains
 * it, the full name replaces it. A genuinely different name is never overwritten — staff
 * are told so they can check. Server-only.
 */
const clean = (s: unknown) => (typeof s === "string" ? s.trim().replace(/\s+/g, " ") : "");
const tokens = (s: string) => s.toLowerCase().split(" ").filter(Boolean);
const PLACEHOLDER = /^(text from |website visitor$|new lead$|unknown$)/i;

export type NameResult = { kind: "none" | "same" | "upgrade" | "different"; name: string };

export function compareName(current: string, candidate: unknown): NameResult {
  const next = clean(candidate);
  const cur = clean(current);
  if (tokens(next).length < 2) return { kind: "none", name: next };
  if (cur.toLowerCase() === next.toLowerCase()) return { kind: "same", name: next };
  if (!cur || PLACEHOLDER.test(cur)) return { kind: "upgrade", name: next };
  const have = tokens(cur), full = tokens(next);
  // Every word on file appears in the fuller name (e.g. "Wyatt" → "Eaton Wyatt Lund").
  if (have.length < full.length && have.every((w) => full.includes(w))) return { kind: "upgrade", name: next };
  return { kind: "different", name: next };
}
