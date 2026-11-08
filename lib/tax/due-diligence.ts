/**
 * Paid-preparer due diligence (based on IRS Form 8867). Required when a return
 * claims the EITC, CTC/ACTC/ODC, AOTC, or Head of Household filing status.
 * The official Form 8867 is still completed in the tax software and filed with
 * the return; this checklist records that the work was done and keeps notes.
 */
import type { DdCredit, DueDiligence } from "./config";

export type DdCheck = { id: string; text: string; credit?: DdCredit };

export const DD_CHECKS: DdCheck[] = [
  { id: "interview", text: "Interviewed the client, asked enough questions, and wrote down their answers at the time (or kept them in the interview)." },
  { id: "consistent", text: "The information is complete and consistent, or I asked follow-up questions about anything that looked incorrect, inconsistent or incomplete." },
  { id: "eligibility", text: "Worked out eligibility and the amount for each credit or filing status claimed, using the IRS worksheets in the software." },
  { id: "documents", text: "Kept copies of (or a record of) the documents the client gave us to support the credits or filing status." },
  { id: "disallowed", text: "Asked whether any of these credits were reduced or disallowed in a prior year, and if so whether Form 8862 is needed." },
  { id: "form8867", text: "Completed Form 8867 in the tax software; it will be filed with the return." },
  { id: "retention", text: "Records (Form 8867, worksheets and supporting documents) will be kept for 3 years." },
  { id: "eitc_child", credit: "EITC", text: "EITC: confirmed each qualifying child's relationship, age and that they lived with the client more than half the year." },
  { id: "eitc_se", credit: "EITC", text: "EITC: if there's self-employment income, asked for records that support the income and expenses reported." },
  { id: "ctc_child", credit: "CTC/ACTC/ODC", text: "CTC/ODC: confirmed each child's relationship, age, residency, and that they have the required SSN (or the other-dependent rules are met)." },
  { id: "aotc_1098t", credit: "AOTC", text: "AOTC: reviewed Form 1098-T (or the school's records) and receipts for qualified education expenses." },
  { id: "aotc_years", credit: "AOTC", text: "AOTC: confirmed the student hasn't claimed the credit for 4 years already and was enrolled at least half time." },
  { id: "hoh_home", credit: "Head of Household", text: "Head of Household: confirmed the client was unmarried (or considered unmarried) and paid more than half the cost of keeping up the home." },
  { id: "hoh_person", credit: "Head of Household", text: "Head of Household: confirmed a qualifying person lived with the client for more than half the year (or the parent rule applies)." },
];

export const checksFor = (credits: DdCredit[]) => DD_CHECKS.filter((c) => !c.credit || credits.includes(c.credit));

/** Done = marked not applicable, or every applicable check ticked and the prior-year question answered. */
export function ddComplete(dd?: DueDiligence) {
  if (!dd?.completedAt) return false;
  if (!dd.applies) return true;
  return dd.credits.length > 0 && !!dd.priorDisallowed && checksFor(dd.credits).every((c) => dd.checks[c.id]);
}
