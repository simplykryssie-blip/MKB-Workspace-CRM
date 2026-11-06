/**
 * Form rules shared by the interface and the server: which questions show,
 * answer validation, publish checks, and turning answers into a lead.
 */
import type { ServiceKey } from "@/lib/types";
import { sensitiveReason, type FormField, type LeadForm } from "./config";

export const digits = (v?: string) => (v ?? "").replace(/\D/g, "");
const SERVICE_KEYS: Record<string, ServiceKey> = { tax: "tax", books: "books", biz: "biz", expunge: "expunge" };
const STATE_NAMES: Record<string, string> = { Louisiana: "LA", Texas: "TX" };

/** Visible fields given the answers so far (show-if rules). */
export const visibleFields = (f: Pick<LeadForm, "fields">, data: Record<string, string>) => f.fields.filter((x) => !x.showIf || (data[x.showIf.fieldId] ?? "").split("|").includes(x.showIf.equals));

export function validateSubmission(f: Pick<LeadForm, "fields">, data: Record<string, string>): Record<string, string> {
  const errs: Record<string, string> = {};
  visibleFields(f, data).forEach((x) => {
    const v = (data[x.id] ?? "").trim();
    if (x.type === "heading" || x.type === "paragraph") return;
    if (x.required && !v) errs[x.id] = x.type === "consent" ? "Please agree to be contacted so we can respond." : "This is required.";
    else if (v && x.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errs[x.id] = "Enter a valid email address.";
    else if (v && x.type === "phone" && digits(v).length !== 10) errs[x.id] = "Enter a 10-digit phone number.";
  });
  return errs;
}

/** Problems that block publishing. */
export function publishIssues(f: Pick<LeadForm, "fields">): string[] {
  const out: string[] = [];
  const maps = f.fields.map((x) => x.map);
  if (!maps.includes("email") && !maps.includes("phone")) out.push("Add an email or phone field mapped to the lead so you can reply.");
  if (!maps.includes("fullName") && !maps.includes("firstName")) out.push("Add a name field mapped to the lead.");
  if (!f.fields.some((x) => x.type === "consent")) out.push("Add a consent checkbox (permission to contact).");
  f.fields.forEach((x) => { const r = sensitiveReason(x); if (r) out.push(`“${x.label}”: ${r}`); });
  f.fields.forEach((x) => { if ((x.type === "radio" || x.type === "checkboxes" || x.type === "select") && !(x.options ?? []).filter((o) => o.trim()).length) out.push(`“${x.label}” needs at least one option.`); });
  return out;
}

/** The lead details a submission carries (only answers to visible questions count). */
export function extractLead(f: Pick<LeadForm, "fields" | "services">, data: Record<string, string>) {
  const vis = visibleFields(f, data);
  const byMap = (m: FormField["map"]) => vis.filter((x) => x.map === m).map((x) => (data[x.id] ?? "").trim()).filter(Boolean);
  const stateRaw = byMap("state")[0];
  return {
    name: byMap("fullName")[0] ?? [byMap("firstName")[0], byMap("lastName")[0]].filter(Boolean).join(" "),
    email: (byMap("email")[0] ?? "").toLowerCase(),
    phone: byMap("phone")[0] ?? "",
    bizName: byMap("businessName")[0],
    entityType: byMap("entityType")[0],
    city: byMap("city")[0] ?? "",
    zip: byMap("zip")[0] ?? "",
    state: stateRaw ? STATE_NAMES[stateRaw] ?? (stateRaw.length === 2 ? stateRaw : undefined) : undefined,
    services: [...new Set([...f.services, ...byMap("services").flatMap((v) => v.split("|")).map((v) => SERVICE_KEYS[v]).filter(Boolean)])] as ServiceKey[],
    summary: vis.filter((x) => x.type !== "heading" && x.type !== "paragraph" && x.type !== "consent" && (data[x.id] ?? "").trim()).map((x) => `${x.label}: ${(data[x.id] ?? "").split("|").join(", ")}`).join("\n"),
  };
}
