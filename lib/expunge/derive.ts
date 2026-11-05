/** Derived state for the Expungement Center. Pure functions — no store or client imports. */
import type { Complexity, ExpCase, ExpMatter, Jurisdiction, Phase, PriceRule } from "./config";

/** Stages shown on the client's expungement engagement (client profile). */
export const EXP_STAGES = ["Intake", "Records collection", "Screening", "Document preparation", "Filing", "Court action", "Completed"] as const;

export const expEnrollmentId = (m: ExpMatter) => `${m.clientId}-ex${m.number.slice(4)}`;

const missing = (c: ExpCase, kind: ExpCase["records"][number]["kind"]) => c.records.some((r) => r.kind === kind && r.required && r.status !== "verified");

/** Dashboard phase for one case. Facts only — never an eligibility call. */
export function casePhase(c: ExpCase, m?: ExpMatter): Phase {
  if (m && (m.intake.status === "inquiry")) return "New inquiry";
  if (c.draft || (m && (m.intake.status === "sent" || m.intake.status === "in_progress"))) return "Intake awaiting completion";
  switch (c.status) {
    case "On Hold":
      return "On hold";
    case "Completed":
      return "Completed";
    case "Denied":
    case "Withdrawn":
      return "Closed — not granted";
    case "Granted":
      return "Order received — finishing";
    case "Hearing Scheduled":
      return "Hearing scheduled";
    case "Submitted":
    case "Awaiting Agency / Court Response":
    case "Additional Information Requested":
      return "Filed / awaiting court action";
    case "Ready for Filing":
      return "Ready for filing";
    case "Awaiting Client Approval":
      return "Awaiting client approval";
    case "Preparing":
      return "Documents being prepared";
  }
  if (c.screening.legalReviewRequired && c.screening.outcome !== "Administrative Processing Approved") return "Flagged for legal review";
  if (c.screening.outcome === "Attorney / Qualified Legal Review Needed") return "Flagged for legal review";
  if (missing(c, "criminal_history") || missing(c, "arrest")) return "Awaiting criminal records";
  if (missing(c, "court_minutes")) return "Awaiting court minutes";
  return "Awaiting eligibility review";
}

/** Phase for a matter with no cases yet. */
export function matterPhase(m: ExpMatter, cases: ExpCase[]): Phase {
  if (m.intake.status === "inquiry") return "New inquiry";
  if (m.intake.status === "sent" || m.intake.status === "in_progress") return "Intake awaiting completion";
  if (!cases.length) return "Awaiting criminal records";
  const order: Phase[] = ["Flagged for legal review", "Awaiting criminal records", "Awaiting court minutes", "Awaiting eligibility review", "Documents being prepared", "Awaiting client approval", "Ready for filing", "Filed / awaiting court action", "Hearing scheduled", "Order received — finishing", "On hold", "Completed", "Closed — not granted"];
  const ps = cases.map((c) => casePhase(c, m));
  return order.find((p) => ps.includes(p)) ?? ps[0];
}

export function matterEnrollment(m: ExpMatter, cases: ExpCase[]): { title: string; stage: string; status: "active" | "waiting_on_client" | "in_review" | "complete" | "on_hold" | "cancelled"; progress: number } {
  const p = matterPhase(m, cases);
  const n = cases.filter((c) => !c.draft).length;
  const stage =
    p === "New inquiry" || p === "Intake awaiting completion" ? "Intake" :
    p === "Awaiting criminal records" || p === "Awaiting court minutes" ? "Records collection" :
    p === "Awaiting eligibility review" || p === "Flagged for legal review" ? "Screening" :
    p === "Documents being prepared" || p === "Awaiting client approval" ? "Document preparation" :
    p === "Ready for filing" ? "Filing" :
    p === "Filed / awaiting court action" || p === "Hearing scheduled" || p === "Order received — finishing" ? "Court action" :
    p === "On hold" ? "Screening" : "Completed";
  const allDone = cases.length > 0 && cases.every((c) => ["Completed", "Denied", "Withdrawn"].includes(c.status));
  const status = allDone ? "complete" : p === "On hold" ? "on_hold" : p === "Intake awaiting completion" || p === "Awaiting client approval" ? "waiting_on_client" : p === "Awaiting eligibility review" || p === "Flagged for legal review" ? "in_review" : "active";
  return { title: `Record expungement — ${n || "no"} case${n === 1 ? "" : "s"}`, stage, status, progress: Math.max(5, Math.round((EXP_STAGES.indexOf(stage as (typeof EXP_STAGES)[number]) / (EXP_STAGES.length - 1)) * 100)) };
}

/** Why screening can't be marked "Administrative Processing Approved" yet. */
export function approvalBlockers(c: ExpCase, j?: Jurisdiction): string[] {
  const out: string[] = [];
  const unverified = c.records.filter((r) => r.required && r.status !== "verified");
  if (unverified.length) out.push(`${unverified.length} required record(s) not verified`);
  if (!j) out.push("No jurisdiction configured");
  else if (!j.lastVerifiedAt) out.push(`${j.stateName} jurisdiction rules have not been verified by an administrator`);
  if (c.screening.legalReviewRequired && !c.screening.reviews.some((r) => r.legal)) out.push("Qualified legal review is required and not recorded");
  if (c.screening.pendingCharges === "yes" || c.screening.obligationsOutstanding === "yes") out.push("Open issues flagged (pending charges or outstanding obligations)");
  return out;
}

export function nextAction(c: ExpCase, m?: ExpMatter): { text: string; owner: "MKB" | "Client" | "Court / agency" | "Legal reviewer" | "Done" } {
  const p = casePhase(c, m);
  switch (p) {
    case "New inquiry": return { text: "Contact the client and send the intake", owner: "MKB" };
    case "Intake awaiting completion": return { text: "Client to finish the intake", owner: "Client" };
    case "Awaiting criminal records": {
      const notReq = c.records.filter((r) => (r.kind === "criminal_history" || r.kind === "arrest") && r.status === "not_requested").length;
      return notReq ? { text: "Request criminal history / arrest records", owner: "MKB" } : { text: "Waiting on records custodians", owner: "Court / agency" };
    }
    case "Awaiting court minutes": return c.records.some((r) => r.kind === "court_minutes" && r.status === "not_requested") ? { text: "Request court minutes", owner: "MKB" } : { text: "Waiting on the clerk for minutes", owner: "Court / agency" };
    case "Awaiting eligibility review": return c.records.some((r) => r.status === "received") ? { text: "Verify received records, then screen", owner: "MKB" } : { text: "Complete the administrative screening", owner: "MKB" };
    case "Flagged for legal review": return { text: "Qualified legal review", owner: "Legal reviewer" };
    case "Documents being prepared": return c.prep.status === "ready_for_review" ? { text: "Internal quality review", owner: "MKB" } : { text: "Prepare documents", owner: "MKB" };
    case "Awaiting client approval": return { text: "Client to approve the prepared documents", owner: "Client" };
    case "Ready for filing": return { text: "Coordinate filing and record the confirmation", owner: "MKB" };
    case "Filed / awaiting court action": return c.status === "Additional Information Requested" ? { text: "Respond to the court's request", owner: "MKB" } : { text: "Follow up with the court", owner: "Court / agency" };
    case "Hearing scheduled": return { text: `Prepare client for hearing${c.filing.hearingAt ? ` (${new Date(c.filing.hearingAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : ""}`, owner: "Client" };
    case "Order received — finishing": return { text: "Deliver the order and close the case", owner: "MKB" };
    case "On hold": return { text: `On hold — ${c.holdReason ?? "see notes"}`, owner: "MKB" };
    case "Completed": return { text: "Complete", owner: "Done" };
    default: return { text: "Closed", owner: "Done" };
  }
}

/** Next deadline for a case (hearing, record request follow-up, or none). */
export function caseDeadline(c: ExpCase): string | undefined {
  if (c.filing.hearingAt && c.status === "Hearing Scheduled") return c.filing.hearingAt;
  const pending = c.records.filter((r) => r.status === "requested" && r.requestedAt).map((r) => new Date(new Date(`${r.requestedAt}T12:00`).getTime() + 21 * 86400000).toISOString());
  return pending.sort()[0];
}

/** Price lookup: exact state first, then "Any". No match → no price (configure it). */
export function priceFor(prices: PriceRule[], serviceTypeId: string, state: string, complexity: Complexity) {
  return prices.find((p) => p.serviceTypeId === serviceTypeId && p.state === state && p.complexity === complexity) ?? prices.find((p) => p.serviceTypeId === serviceTypeId && p.state === "Any" && p.complexity === complexity);
}
