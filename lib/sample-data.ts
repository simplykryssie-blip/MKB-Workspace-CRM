/**
 * SAMPLE DATA — DESIGN PREVIEW ONLY
 *
 * Every name, company, amount and date in this file is fictional and exists
 * only to demonstrate the interface. No real client information may ever be
 * added here. This module is replaced by real queries in Phase 3.
 */

export type ServiceKey = "tax" | "books" | "biz" | "expunge";

export const SERVICES: Record<
  ServiceKey,
  { label: string; short: string; href: string }
> = {
  tax: { label: "Tax Preparation", short: "Tax", href: "/services/tax-preparation" },
  books: { label: "Bookkeeping", short: "Bookkeeping", href: "/services/bookkeeping" },
  biz: { label: "Business Services", short: "Business", href: "/services/business-services" },
  expunge: { label: "Record Expungement", short: "Expungement", href: "/services/record-expungement" },
};

export const SERVICE_ORDER: ServiceKey[] = ["tax", "books", "biz", "expunge"];

export const kpis = {
  totalClients: { value: 542, delta: 12, period: "vs last month" },
  activeEngagements: { value: 487, delta: 8, period: "vs last month" },
  newLeads: { value: 36, delta: 44, period: "vs last month" },
  pendingDocuments: { value: 128, delta: -15, period: "vs last month" },
  outstandingInvoices: { value: 18450, count: 23, delta: -6, period: "vs last month" },
};

/** Daily revenue points for the selected range (sample). */
export type RevenuePoint = { label: string; value: number };

export const revenueRanges: Record<
  "30d" | "90d" | "ytd",
  { title: string; total: number; delta: number; points: RevenuePoint[] }
> = {
  "30d": {
    title: "Last 30 days",
    total: 42680,
    delta: 18,
    points: [
      { label: "Oct 6", value: 9800 },
      { label: "Oct 9", value: 14200 },
      { label: "Oct 12", value: 15600 },
      { label: "Oct 15", value: 20100 },
      { label: "Oct 18", value: 23400 },
      { label: "Oct 21", value: 22700 },
      { label: "Oct 24", value: 26200 },
      { label: "Oct 27", value: 33100 },
      { label: "Oct 30", value: 31000 },
      { label: "Nov 2", value: 35800 },
      { label: "Nov 5", value: 42680 },
    ],
  },
  "90d": {
    title: "Last 90 days",
    total: 118940,
    delta: 11,
    points: [
      { label: "Aug 7", value: 6200 },
      { label: "Aug 22", value: 19800 },
      { label: "Sep 6", value: 36400 },
      { label: "Sep 21", value: 55100 },
      { label: "Oct 6", value: 76260 },
      { label: "Oct 21", value: 98700 },
      { label: "Nov 5", value: 118940 },
    ],
  },
  ytd: {
    title: "Year to date",
    total: 486200,
    delta: 23,
    points: [
      { label: "Jan", value: 21400 },
      { label: "Feb", value: 68900 },
      { label: "Mar", value: 142300 },
      { label: "Apr", value: 228600 },
      { label: "May", value: 251900 },
      { label: "Jun", value: 279300 },
      { label: "Jul", value: 305100 },
      { label: "Aug", value: 331800 },
      { label: "Sep", value: 367520 },
      { label: "Oct", value: 410600 },
      { label: "Nov", value: 486200 },
    ],
  },
};

export const servicePerformance: { key: ServiceKey; active: number; revenue: number }[] = [
  { key: "tax", active: 185, revenue: 17920 },
  { key: "books", active: 127, revenue: 12310 },
  { key: "biz", active: 107, revenue: 7840 },
  { key: "expunge", active: 68, revenue: 4610 },
];

export const appointments: {
  time: string;
  title: string;
  client: string;
  service: ServiceKey;
  mode: "In person" | "Video" | "Phone";
  staff: string;
}[] = [
  { time: "10:00 AM", title: "Tax return review", client: "Jordan Sample", service: "tax", mode: "Video", staff: "AL" },
  { time: "11:30 AM", title: "Bookkeeping check-in", client: "Maple Example LLC", service: "books", mode: "Phone", staff: "RT" },
  { time: "2:00 PM", title: "Business formation", client: "Northwind Demo Co.", service: "biz", mode: "In person", staff: "MK" },
  { time: "4:00 PM", title: "Expungement consultation", client: "Casey Placeholder", service: "expunge", mode: "Video", staff: "AL" },
];

export const tasks: {
  id: string;
  title: string;
  service: ServiceKey | null;
  due: string;
  urgency: "today" | "soon" | "later" | "overdue";
}[] = [
  { id: "t1", title: "Review 12 pending tax documents", service: "tax", due: "Overdue", urgency: "overdue" },
  { id: "t2", title: "Send November bookkeeping invoices", service: "books", due: "Due today", urgency: "today" },
  { id: "t3", title: "Follow up on 5 new leads", service: null, due: "Tomorrow", urgency: "soon" },
  { id: "t4", title: "Prepare 3 expungement filings", service: "expunge", due: "Nov 12", urgency: "later" },
  { id: "t5", title: "Annual report reminders — 8 entities", service: "biz", due: "Nov 14", urgency: "later" },
];

export const activity: {
  who: string;
  initials: string;
  action: string;
  target: string;
  when: string;
  kind: "upload" | "payment" | "signature" | "message" | "intake";
}[] = [
  { who: "Jordan Sample", initials: "JS", action: "uploaded", target: "2025 W-2 (2 files)", when: "12 min ago", kind: "upload" },
  { who: "Maple Example LLC", initials: "ME", action: "paid invoice", target: "INV-1042 · $650.00", when: "48 min ago", kind: "payment" },
  { who: "Casey Placeholder", initials: "CP", action: "signed", target: "Engagement letter", when: "2 h ago", kind: "signature" },
  { who: "Riley Testcase", initials: "RT", action: "completed intake", target: "Business formation", when: "3 h ago", kind: "intake" },
  { who: "Northwind Demo Co.", initials: "ND", action: "sent a message", target: "Question about EIN", when: "Yesterday", kind: "message" },
];

export const invoices: {
  number: string;
  client: string;
  service: ServiceKey;
  amount: number;
  status: "overdue" | "due-soon" | "sent";
  due: string;
}[] = [
  { number: "INV-1038", client: "Avery Fictional", service: "tax", amount: 425, status: "overdue", due: "14 days overdue" },
  { number: "INV-1041", client: "Bluebird Sample Inc.", service: "books", amount: 1200, status: "overdue", due: "3 days overdue" },
  { number: "INV-1045", client: "Northwind Demo Co.", service: "biz", amount: 899, status: "due-soon", due: "Due in 2 days" },
  { number: "INV-1047", client: "Casey Placeholder", service: "expunge", amount: 750, status: "sent", due: "Due Nov 20" },
];

export const invoiceAging = [
  { label: "Current", amount: 9870 },
  { label: "1–30 days", amount: 5130 },
  { label: "31–60 days", amount: 2240 },
  { label: "60+ days", amount: 1210 },
];

export const currentUser = { name: "MKB", fullName: "MKB Owner", initials: "MK", role: "Owner" };

export const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
