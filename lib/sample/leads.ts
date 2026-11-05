/**
 * SAMPLE LEADS — DESIGN PREVIEW ONLY.
 * All names, businesses, emails (example.com) and phone numbers (555-01xx)
 * are fictional. Never add real prospect information here.
 */
import { SAMPLE_NOW } from "@/lib/sample/clients";
import type { ActivityItem, Lead, LeadPriority, LeadStage, LeadStatus, Note, ServiceKey } from "@/lib/types";

export const DEFAULT_STAGES: LeadStage[] = [
  { id: "st-new", name: "New" },
  { id: "st-contacted", name: "Contacted" },
  { id: "st-qualified", name: "Qualified" },
  { id: "st-consult", name: "Consultation scheduled" },
  { id: "st-proposal", name: "Proposal sent" },
];

export const DEFAULT_SOURCES = ["Website", "Facebook", "Instagram", "Google", "Referral", "Phone call", "Walk-in", "Community partner", "Event", "Email"];

export const LOST_REASONS = ["Chose another provider", "Price", "No response", "Not a fit for our services", "Timing — revisit later", "Duplicate lead", "Other"];

const d = (days: number, h = 10, m = 0) => {
  const t = new Date(SAMPLE_NOW);
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};

type Seed = {
  id: string;
  type: Lead["type"];
  name: string;
  contactName?: string;
  email: string;
  phone: string;
  city: string;
  business?: Lead["business"];
  source: string;
  sourceDetail?: string;
  interests: ServiceKey[];
  estValue: number;
  ownerId: string;
  stage: number; // index into DEFAULT_STAGES
  status?: LeadStatus;
  priority: LeadPriority;
  createdDaysAgo: number;
  followUp?: { days: number; hour?: number; note: string };
  notes?: string[];
  tags?: string[];
  lostReason?: string;
  convertedClientId?: string;
};

const SEEDS: Seed[] = [
  { id: "L-2001", type: "individual", name: "Dana Sampleton", email: "dana.sampleton@example.com", phone: "(555) 010-0101", city: "Springfield", source: "Facebook", sourceDetail: "Tax season ad (sample)", interests: ["tax"], estValue: 425, ownerId: "s-al", stage: 0, priority: "high", createdDaysAgo: 0, followUp: { days: 0, hour: 15, note: "Intro call — explain document checklist" }, notes: ["Filled out the website form after seeing the ad. Has W-2 + 1099 income."] },
  { id: "L-2002", type: "business", name: "Brightline Demo Logistics LLC", contactName: "Morgan Brightline", email: "ops@brightline-demo.example.com", phone: "(555) 010-0102", city: "Riverton", business: { entityType: "LLC", industry: "Logistics" }, source: "Website", interests: ["books", "tax"], estValue: 3600, ownerId: "s-rt", stage: 2, priority: "high", createdDaysAgo: 9, followUp: { days: 1, hour: 11, note: "Send monthly bookkeeping quote" }, notes: ["12 trucks, behind on books since July. Wants monthly close + year-end return.", "Uses a sample accounting app — confirm export access."], tags: ["Hot"] },
  { id: "L-2003", type: "individual", name: "Kendall Mockford", email: "kendall.mockford@example.com", phone: "(555) 010-0103", city: "Lakeside", source: "Referral", sourceDetail: "Referred by Jordan Sample", interests: ["tax"], estValue: 425, ownerId: "s-al", stage: 1, priority: "medium", createdDaysAgo: 6, followUp: { days: -2, hour: 10, note: "Second call attempt" }, notes: ["Left voicemail on first attempt."] },
  { id: "L-2004", type: "individual", name: "Skyler Testwood", email: "skyler.testwood@example.com", phone: "(555) 010-0104", city: "Fairview", source: "Community partner", sourceDetail: "Workforce partner (sample)", interests: ["expunge"], estValue: 750, ownerId: "s-jp", stage: 3, priority: "high", createdDaysAgo: 11, followUp: { days: 3, hour: 14, note: "Consultation — bring any court paperwork" }, notes: ["Two older cases in one county. Job offer pending a background check."], tags: ["Employment-motivated"] },
  { id: "L-2005", type: "business", name: "Golden Example Catering LLC", contactName: "Sam Golden", email: "hello@golden-example.example.com", phone: "(555) 010-0106", city: "Bayview", business: { entityType: "LLC", industry: "Food & beverage" }, source: "Walk-in", interests: ["biz"], estValue: 650, ownerId: "s-mk", stage: 4, priority: "medium", createdDaysAgo: 15, followUp: { days: 5, hour: 9, note: "Check whether proposal was reviewed" }, notes: ["Needs food service permit + county business license renewal."] },
  { id: "L-2006", type: "individual", name: "Reese Placeholder", email: "reese.placeholder@example.com", phone: "(555) 010-0107", city: "Oakdale", source: "Phone call", interests: ["expunge"], estValue: 750, ownerId: "s-jp", stage: 0, priority: "urgent", createdDaysAgo: 1, followUp: { days: -1, hour: 16, note: "Call back — court date questions" }, notes: ["Called in asking about a hearing next month. Wants to know timelines."] },
  { id: "L-2007", type: "business", name: "Ocean Demo Fitness Studio", contactName: "Jordan Ocean", email: "studio@ocean-demo.example.com", phone: "(555) 010-0108", city: "Bayview", business: { entityType: "Sole Prop", industry: "Fitness" }, source: "Instagram", interests: ["books"], estValue: 1800, ownerId: "s-rt", stage: 1, priority: "medium", createdDaysAgo: 4, followUp: { days: 7, hour: 13, note: "Follow up after their busy season" } },
  { id: "L-2008", type: "individual", name: "Parker Fakeworth", email: "parker.fakeworth@example.com", phone: "(555) 010-0110", city: "Springfield", source: "Google", interests: ["tax", "expunge"], estValue: 1175, ownerId: "s-al", stage: 2, priority: "medium", createdDaysAgo: 8, followUp: { days: 0, hour: 11, note: "Confirm both services + bundle pricing" }, notes: ["Interested in both — record restriction first, then 2025 return."], tags: ["Multi-service"] },
  { id: "L-2009", type: "business", name: "Summit Sample Roofing Inc.", contactName: "Casey Summit", email: "office@summit-sample.example.com", phone: "(555) 010-0111", city: "Riverton", business: { entityType: "S-Corp", industry: "Construction" }, source: "Referral", sourceDetail: "Referred by Maple Example LLC", interests: ["tax", "books"], estValue: 4800, ownerId: "s-rt", stage: 4, priority: "high", createdDaysAgo: 18, followUp: { days: 2, hour: 10, note: "Proposal walkthrough call" }, notes: ["S-Corp with payroll. Current preparer retiring."], tags: ["Hot", "Payroll"] },
  { id: "L-2010", type: "individual", name: "Jessie Mocktail", email: "jessie.mocktail@example.com", phone: "(555) 010-0112", city: "Lakeside", source: "Event", sourceDetail: "Community tax day (sample)", interests: ["tax"], estValue: 300, ownerId: "s-al", stage: 0, priority: "low", createdDaysAgo: 2 },
  { id: "L-2011", type: "business", name: "Lumen Demo Labs LLC", contactName: "Riley Lumen", email: "founders@lumen-demo.example.com", phone: "(555) 010-0113", city: "Oakdale", business: { entityType: "LLC", industry: "Software" }, source: "Email", interests: ["biz", "books"], estValue: 1550, ownerId: "s-mk", stage: 3, priority: "medium", createdDaysAgo: 5, followUp: { days: 1, hour: 15, note: "Formation consult — multi-member LLC" } },
  { id: "L-2012", type: "individual", name: "Rowan Exampleton", email: "rowan.exampleton@example.com", phone: "(555) 010-0114", city: "Fairview", source: "Website", interests: ["books"], estValue: 900, ownerId: "s-rt", stage: 1, priority: "low", createdDaysAgo: 13, followUp: { days: 10, hour: 10, note: "Quarterly check-in" } },
  { id: "L-2013", type: "individual", name: "Avery Demo-Lane", email: "avery.demolane@example.com", phone: "(555) 010-0115", city: "Springfield", source: "Facebook", interests: ["tax"], estValue: 425, ownerId: "s-al", stage: 0, priority: "medium", createdDaysAgo: 0 },
  { id: "L-2014", type: "individual", name: "Riley Testcase", email: "riley.testcase@example.com", phone: "(555) 010-0105", city: "Springfield", source: "Instagram", interests: ["biz"], estValue: 499, ownerId: "s-mk", stage: 4, status: "converted", priority: "medium", createdDaysAgo: 9, convertedClientId: "c-1005", notes: ["Wants to start a home-based business this spring."] },
  { id: "L-2015", type: "business", name: "Northwind Demo Co.", contactName: "Sam Northwind", email: "sam@northwind-demo.example.com", phone: "(555) 010-0118", city: "Lakeside", business: { entityType: "LLC", industry: "Consulting" }, source: "Google", interests: ["biz"], estValue: 899, ownerId: "s-mk", stage: 3, status: "converted", priority: "high", createdDaysAgo: 20, convertedClientId: "c-1003", notes: ["Needs LLC + EIN before signing first contract."] },
  { id: "L-2016", type: "individual", name: "Frankie Sample", email: "frankie.sample@example.com", phone: "(555) 010-0116", city: "Oakdale", source: "Google", interests: ["tax"], estValue: 425, ownerId: "s-al", stage: 1, status: "lost", priority: "low", createdDaysAgo: 25, lostReason: "Chose another provider" },
  { id: "L-2017", type: "business", name: "Coastal Demo Vending LLC", contactName: "Taylor Coastal", email: "info@coastal-demo.example.com", phone: "(555) 010-0117", city: "Bayview", business: { entityType: "LLC", industry: "Retail" }, source: "Website", interests: ["biz"], estValue: 450, ownerId: "s-mk", stage: 1, status: "lost", priority: "low", createdDaysAgo: 30, lostReason: "No response" },
];

const CONVERT_DAYS: Record<string, number> = { "c-1005": 2, "c-1003": 12 };

function build(s: Seed, i: number): Lead {
  const created = d(-s.createdDaysAgo, 9 + (i % 6), (i * 13) % 60);
  const activity: ActivityItem[] = [{ id: `${s.id}-x0`, kind: "lead", text: `Lead created from ${s.source}${s.sourceDetail ? ` (${s.sourceDetail})` : ""}`, at: created, actor: "system" }];
  const step = s.createdDaysAgo / Math.max(1, s.stage + 1);
  for (let k = 1; k <= s.stage; k++) {
    const at = d(-Math.max(0, Math.round(s.createdDaysAgo - step * k)), 11 + (k % 5), 15);
    if (k === 1) activity.push({ id: `${s.id}-c${k}`, kind: "call", text: "Logged call: introduced services, answered questions", at, actor: "staff" });
    activity.push({ id: `${s.id}-x${k}`, kind: "lead", text: `Moved to "${DEFAULT_STAGES[k].name}"`, at, actor: "staff" });
    if (k === 4) activity.push({ id: `${s.id}-e${k}`, kind: "message", text: "Sent proposal by email", at, actor: "staff" });
  }
  const notes: Note[] = (s.notes ?? []).map((body, k) => ({ id: `${s.id}-n${k}`, authorId: s.ownerId, body, at: d(-Math.max(0, s.createdDaysAgo - k), 12, 30), pinned: k === 0 }));
  const status = s.status ?? "open";
  let convertedAt: string | undefined;
  if (status === "converted" && s.convertedClientId) {
    convertedAt = d(-(CONVERT_DAYS[s.convertedClientId] ?? 1), 12, 0);
    activity.push({ id: `${s.id}-conv`, kind: "lead", text: "Converted to client", at: convertedAt, actor: "staff" });
  }
  if (status === "lost") activity.push({ id: `${s.id}-lost`, kind: "lead", text: `Marked lost: ${s.lostReason}`, at: d(-Math.round(s.createdDaysAgo / 2), 16, 0), actor: "staff" });
  activity.sort((a, b) => b.at.localeCompare(a.at));
  return {
    id: s.id,
    type: s.type,
    name: s.name,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    address: { line1: "", city: s.city, state: "GA", zip: "" },
    business: s.business,
    source: s.source,
    sourceDetail: s.sourceDetail,
    interests: s.interests,
    estValue: s.estValue,
    ownerId: s.ownerId,
    stageId: DEFAULT_STAGES[s.stage].id,
    status,
    priority: s.priority,
    tags: s.tags ?? [],
    createdAt: created,
    lastActivityAt: activity[0].at,
    reminders: s.followUp ? [{ id: `${s.id}-r1`, at: d(s.followUp.days, s.followUp.hour ?? 10), note: s.followUp.note, done: false, ownerId: s.ownerId }] : [],
    notes,
    activity,
    lostReason: s.lostReason,
    convertedClientId: s.convertedClientId,
    convertedAt,
  };
}

export const LEADS: Lead[] = SEEDS.map(build);

/** Next open reminder (the lead's follow-up date). */
export const nextFollowUp = (l: Lead) => l.reminders.filter((r) => !r.done).sort((a, b) => a.at.localeCompare(b.at))[0];

export type FollowUpBucket = "overdue" | "today" | "week" | "later" | "none";
export function followUpBucket(l: Lead, now = SAMPLE_NOW): FollowUpBucket {
  const r = nextFollowUp(l);
  if (!r || l.status !== "open") return "none";
  const t = new Date(r.at);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  const endWeek = new Date(startToday);
  endWeek.setDate(endWeek.getDate() + 7);
  if (t < startToday) return "overdue";
  if (t < endToday) return "today";
  if (t < endWeek) return "week";
  return "later";
}

export const PRIORITY_ORDER: Record<LeadPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
