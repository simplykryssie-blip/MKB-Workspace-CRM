/**
 * Bookkeeping proposal — the price MKB reviews after an intake is submitted and
 * sends to the client with the engagement letter. Clients never see a price
 * before this. Shared by the staff screen, the client's link and the server.
 */
import { money, QUARTERLY_TERMS, type BooksQuote } from "@/lib/fees/config";

/** quarterly = recurring each quarter, paid in full before that quarter's work begins. */
export type ProposalBilling = "monthly" | "quarterly" | "one_time" | "quote";
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

/** Every bookkeeping client keeps their own accounting software (shown on the proposal and in the signed copy). */
export const SOFTWARE_REQUIRED = "Once you sign, you'll need your own accounting software subscription in your business's name — we work in your books, and you own your books and your data. We suggest QuickBooks Online, Wave, Xero or FreshBooks. The subscription is paid by you directly to the software company and isn't included in our fees. Already have one? We'll use it.";

export const BILLING_LABEL: Record<ProposalBilling, string> = { monthly: "Monthly", quarterly: "Quarterly (paid upfront)", one_time: "One-time", quote: "Custom quote" };

export const proposalTotals = (p: { lines: Omit<ProposalLine, "id">[] }) => ({
  monthly: p.lines.filter((l) => l.billing === "monthly").reduce((s, l) => s + l.amount, 0),
  quarterly: p.lines.filter((l) => l.billing === "quarterly").reduce((s, l) => s + l.amount, 0),
  oneTime: p.lines.filter((l) => l.billing === "one_time").reduce((s, l) => s + l.amount, 0),
  quoted: p.lines.filter((l) => l.billing === "quote"),
  startingAt: p.lines.some((l) => (l.billing === "monthly" || l.billing === "quarterly") && l.startingAt),
});
/** Quarterly when the proposal's recurring price is per quarter. */
export const isQuarterly = (p: { lines: Omit<ProposalLine, "id">[] }) => p.lines.some((l) => l.billing === "quarterly");
/** The recurring price and its period, e.g. { amount: 1482, per: "quarter" }. */
export const recurring = (p: { lines: Omit<ProposalLine, "id">[] }) => { const t = proposalTotals(p); return isQuarterly(p) ? { amount: t.quarterly, per: "quarter" as const } : { amount: t.monthly, per: "month" as const }; };

let n = 0;
export const lineId = () => `pl${Date.now().toString(36)}${(n++).toString(36)}`;

/** A draft proposal from the automatic quote — the starting point for MKB's review. */
export function proposalFromQuote(q: BooksQuote, at: string): Proposal {
  const lines: ProposalLine[] = [
    ...q.monthly.map((l) => ({ id: lineId(), label: l.label, billing: (l.billing === "quarterly" ? "quarterly" : "monthly") as ProposalBilling, amount: l.amount, startingAt: l.startingAt || undefined })),
    ...q.oneTime.map((l) => ({ id: lineId(), label: l.label, billing: "one_time" as const, amount: l.amount, startingAt: l.startingAt || undefined })),
    ...q.quoted.map((l) => ({ id: lineId(), label: l.label, billing: "quote" as const, amount: 0 })),
  ];
  return { version: 1, status: "draft", plan: q.plan.key, lines, suggested: { plan: q.plan.key, monthlyTotal: q.monthlyTotal, oneTimeTotal: q.oneTimeTotal }, updatedAt: at };
}

const amt = (l: ProposalLine) => (l.billing === "quote" ? "custom quote" : `${l.startingAt ? "starting at " : ""}${money(l.amount)}${l.billing === "monthly" ? "/month" : l.billing === "quarterly" ? "/quarter" : " one-time"}`);

/**
 * A saved bookkeeping letter written before quarterly billing said "Your monthly fee is {{fee}},
 * billed monthly in advance." — {{fee}} now carries its own billing terms, so that sentence is
 * read as "Your fee is {{fee}}." (no double or wrong wording for quarterly clients).
 */
export const booksLetterBody = (body: string) => body
  .replace("Your monthly fee is {{fee}}, billed monthly in advance.", "Your fee is {{fee}}.")
  .replace("- Keep your own accounting software subscription (such as QuickBooks Online). You own your books and your data.", "- Have your own accounting software subscription in the business's name once this letter is signed (we suggest QuickBooks Online, Wave, Xero or FreshBooks), paid directly by you to the software company. You own your books and your data.");

/** Words for the engagement letter's fill-ins, from the reviewed proposal. */
export function proposalLetterVars(p: Proposal, planIncludes: string[]) {
  const t = proposalTotals(p);
  const extra = p.lines.filter((l) => !((l.billing === "monthly" || l.billing === "quarterly") && l.label === `${p.plan} plan`));
  const r = recurring(p);
  return {
    service: p.plan,
    fee: `${t.startingAt ? "starting at " : ""}${money(r.amount)} per ${r.per}${r.per === "quarter" ? ` (quarterly bookkeeping). ${QUARTERLY_TERMS}` : ", billed monthly in advance"}`,
    planIncludes: planIncludes.join("; "),
    addOns: extra.map((l) => `${l.label} (${amt(l)})`).join("; ") || "none",
  };
}

/** The proposal as letter text (## headings, - bullets) — printed before the engagement letter. */
export function proposalAsText(p: Proposal) {
  const t = proposalTotals(p);
  const q = isQuarterly(p);
  const rec = q ? "quarterly" : "monthly";
  return [
    ...(p.message ? [p.message, ""] : []),
    q ? "## Quarterly" : "## Monthly",
    ...p.lines.filter((l) => l.billing === rec).map((l) => `- ${l.label}: ${amt(l)}`),
    `- ${q ? "Quarterly" : "Monthly"} total: ${t.startingAt ? "starting at " : ""}${money(q ? t.quarterly : t.monthly)}`,
    ...(q ? [`- ${QUARTERLY_TERMS}`] : []),
    ...(p.lines.some((l) => l.billing !== rec) ? ["", "## One-time and custom-quoted work", ...p.lines.filter((l) => l.billing !== rec).map((l) => `- ${l.label}: ${amt(l)}`)] : []),
    "",
    "## Your accounting software",
    `- ${SOFTWARE_REQUIRED}`,
    "",
    `Prices are reviewed by MKB from your intake answers. ${q ? "Quarterly fees are paid in full at the start of each quarter, before any work on that quarter begins." : "Monthly fees are billed monthly in advance."} Catch-up work (months that were never entered) and cleanup work (fixing books that were kept with errors) are priced separately above. Custom-quoted work is agreed in writing before it starts.`,
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
