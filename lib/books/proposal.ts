/**
 * Bookkeeping proposal — the price MKB reviews after an intake is submitted and
 * sends to the client with the engagement letter. Clients never see a price
 * before this. Shared by the staff screen, the client's link and the server.
 */
import { money, type BooksQuote } from "@/lib/fees/config";

export type ProposalBilling = "monthly" | "one_time" | "quote";
export type ProposalLine = { id: string; label: string; billing: ProposalBilling; amount: number; startingAt?: boolean };
export type ProposalStatus = "draft" | "sent" | "signed";
export type Proposal = {
  version: number;
  status: ProposalStatus;
  plan: string;
  lines: ProposalLine[];
  /** Optional note shown to the client above the price. */
  message?: string;
  /** The automatic quote the review started from (for comparison). */
  suggested?: { plan: string; monthlyTotal: number; oneTimeTotal: number };
  updatedAt: string;
  updatedBy?: string;
  sentAt?: string;
  sentTo?: string;
  signedAt?: string;
  signedName?: string;
  signature?: { key: string; sha256: string; bytes: number };
  letter?: { version: number; termsVersion: number };
  /** Earlier signed versions (kept when a signed proposal is revised). */
  previous?: { version: number; signedAt: string; signedName: string; monthlyTotal: number; oneTimeTotal: number }[];
};

export const BILLING_LABEL: Record<ProposalBilling, string> = { monthly: "Monthly", one_time: "One-time", quote: "Custom quote" };

export const proposalTotals = (p: { lines: Omit<ProposalLine, "id">[] }) => ({
  monthly: p.lines.filter((l) => l.billing === "monthly").reduce((s, l) => s + l.amount, 0),
  oneTime: p.lines.filter((l) => l.billing === "one_time").reduce((s, l) => s + l.amount, 0),
  quoted: p.lines.filter((l) => l.billing === "quote"),
  startingAt: p.lines.some((l) => l.billing === "monthly" && l.startingAt),
});

let n = 0;
export const lineId = () => `pl${Date.now().toString(36)}${(n++).toString(36)}`;

/** A draft proposal from the automatic quote — the starting point for MKB's review. */
export function proposalFromQuote(q: BooksQuote, at: string): Proposal {
  const lines: ProposalLine[] = [
    ...q.monthly.map((l) => ({ id: lineId(), label: l.label, billing: "monthly" as const, amount: l.amount, startingAt: l.startingAt || undefined })),
    ...q.oneTime.map((l) => ({ id: lineId(), label: l.label, billing: "one_time" as const, amount: l.amount, startingAt: l.startingAt || undefined })),
    ...q.quoted.map((l) => ({ id: lineId(), label: l.label, billing: "quote" as const, amount: 0 })),
  ];
  return { version: 1, status: "draft", plan: q.plan.key, lines, suggested: { plan: q.plan.key, monthlyTotal: q.monthlyTotal, oneTimeTotal: q.oneTimeTotal }, updatedAt: at };
}

const amt = (l: ProposalLine) => (l.billing === "quote" ? "custom quote" : `${l.startingAt ? "starting at " : ""}${money(l.amount)}${l.billing === "monthly" ? "/month" : " one-time"}`);

/** Words for the engagement letter's fill-ins, from the reviewed proposal. */
export function proposalLetterVars(p: Proposal, planIncludes: string[]) {
  const t = proposalTotals(p);
  const extra = p.lines.filter((l) => !(l.billing === "monthly" && l.label === `${p.plan} plan`));
  return {
    service: p.plan,
    fee: `${t.startingAt ? "starting at " : ""}${money(t.monthly)}`,
    planIncludes: planIncludes.join("; "),
    addOns: extra.map((l) => `${l.label} (${amt(l)})`).join("; ") || "none",
  };
}

/** The proposal as letter text (## headings, - bullets) — printed before the engagement letter. */
export function proposalAsText(p: Proposal) {
  const t = proposalTotals(p);
  return [
    ...(p.message ? [p.message, ""] : []),
    "## Monthly",
    ...p.lines.filter((l) => l.billing === "monthly").map((l) => `- ${l.label}: ${amt(l)}`),
    `- Monthly total: ${t.startingAt ? "starting at " : ""}${money(t.monthly)}`,
    ...(p.lines.some((l) => l.billing !== "monthly") ? ["", "## One-time and custom-quoted work", ...p.lines.filter((l) => l.billing !== "monthly").map((l) => `- ${l.label}: ${amt(l)}`)] : []),
    "",
    "Prices are reviewed by MKB from your intake answers. Monthly fees are billed monthly in advance. Custom-quoted work is agreed in writing before it starts.",
  ].join("\n");
}

/** Where a submitted intake is in review → proposal → signature. */
export type BooksStage = "in_progress" | "in_review" | "proposal_sent" | "signed" | "started";
export function booksStage(i: { status: string; workspaceId?: string; proposal?: Proposal | null }): BooksStage {
  if (i.workspaceId) return "started";
  if (i.status !== "submitted") return "in_progress";
  if (i.proposal?.status === "signed") return "signed";
  if (i.proposal?.status === "sent") return "proposal_sent";
  return "in_review";
}
export const STAGE_LABEL: Record<BooksStage, string> = { in_progress: "In progress", in_review: "In review", proposal_sent: "Proposal sent", signed: "Signed — ready to start", started: "Bookkeeping started" };
