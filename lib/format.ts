import { SAMPLE_NOW } from "@/lib/sample/clients";

export const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  new Date(iso).toLocaleDateString("en-US", opts);

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export const fmtDateTime = (iso: string) => `${fmtDate(iso, { month: "short", day: "numeric" })} · ${fmtTime(iso)}`;

/** Relative to the fixed sample "now" so the preview stays stable. */
export function relTime(iso: string, now = SAMPLE_NOW) {
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const future = diff > 0;
  const fmt = (n: number, u: string) => (future ? `in ${n} ${u}${n === 1 ? "" : "s"}` : `${n} ${u}${n === 1 ? "" : "s"} ago`);
  if (abs < 60) return "just now";
  if (abs < 3600) return fmt(Math.round(abs / 60), "min");
  if (abs < 86400) return fmt(Math.round(abs / 3600), "hour");
  const days = Math.round(abs / 86400);
  if (days === 1) return future ? "tomorrow" : "yesterday";
  if (days < 30) return fmt(days, "day");
  if (days < 365) return fmt(Math.round(days / 30), "month");
  return fmt(Math.round(days / 365), "year");
}

export const initials = (name: string) =>
  name
    .replace(/[^A-Za-z &-]/g, "")
    .split(/[\s&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export const fileSize = (kb?: number) => (kb == null ? "" : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
