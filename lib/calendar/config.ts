/**
 * The Calendar (appointments, time blocks and tasks) — shared by the staff
 * screens and the server. One calendar for MKB and Monarch; every staff
 * member has their own.
 */
export type Brand = "mkb" | "monarch";
export type Location = "video" | "phone" | "in_person";
export const LOCATIONS: Record<Location, string> = { video: "Video call", phone: "Phone call", in_person: "In person" };
export const SERVICES: Record<string, string> = { other: "General", tax: "Tax", books: "Bookkeeping & payroll", biz: "Business Solutions", expunge: "Record Relief", monarch: "Monarch" };
export const PRIORITIES = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" } as const;
export type Priority = keyof typeof PRIORITIES;
export const REPEATS = { none: "Doesn't repeat", daily: "Every day", weekly: "Every week", monthly: "Every month", quarterly: "Every 3 months", yearly: "Every year" } as const;
export type Repeat = keyof typeof REPEATS;
export const STATUS_LABEL = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" } as const;
export type ApptStatus = keyof typeof STATUS_LABEL;
export const COLORS = ["#b87912", "#2563eb", "#0d9488", "#7c3aed", "#ea580c", "#db2777", "#16a34a", "#a16207", "#0891b2", "#475569"];

export type ApptType = { id: string; name: string; brand: Brand; service: string; durationMin: number; location: Location; locationNote: string; color: string; priceCents: number; bufferMin: number; description: string; bookable: boolean; active: boolean; position: number; memberIds: string[] };
export type Contact = { type: "lead" | "client" | "office"; id: string; name: string };
export type Appt = {
  id: string; kind: "appointment" | "block"; typeId?: string; title: string; brand: Brand; service: string; memberId: string;
  startsAt: string; endsAt: string; location: Location; locationNote: string; contact: Contact | null; status: ApptStatus; notes: string; source: string; rev: number;
  guestEmail: string; guestPhone: string; meetingUrl: string; priceCents: number; paymentStatus: "none" | "pending" | "paid" | "refunded";
};
export type Task = {
  id: string; title: string; notes: string; dueAt?: string; allDay: boolean; priority: Priority; status: "open" | "done"; doneAt?: string;
  assigneeId: string; brand: Brand; service: string; contact: Contact | null; checklist: { id: string; text: string; done: boolean }[]; repeat: Repeat; rev: number;
};
/** Items from elsewhere in the CRM that show in the planner (lead follow-ups). */
export type FollowUp = { id: string; kind: "lead_followup"; title: string; dueAt: string; memberId: string; contact: Contact; href: string };
export type CalMember = { id: string; name: string; initials: string; color: string; me: boolean };

export const contactHref = (c: Contact | null) => (!c ? null : c.type === "lead" ? `/leads/${c.id}` : c.type === "client" ? `/clients/${c.id}` : `/monarch/offices/${c.id}`);

/* ---------------------------------------------------------------- online booking */
export const DAYS = [["sun", "Sunday"], ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"]] as const;
export type DayKey = (typeof DAYS)[number][0];
/** Weekly hours in the staff member's time zone: {"mon": [["09:00","17:00"]], ...}. */
export type Hours = Partial<Record<DayKey, [string, string][]>>;
export const TIMEZONES = ["America/Chicago", "America/New_York", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"];
export type MyHours = { memberId: string; name: string; timezone: string; hours: Hours; bookingOn: boolean; daysOff: string[]; zoomUser: string };
export type BookingSettings = { minNoticeHours: number; windowDays: number; slotStepMin: number; changeNoticeHours: number; reminders: number[]; zoom: { accountId: string; clientId: string; secretSaved: { last4: string; at: string } | null }; stripe: boolean; links: { mkb: string; monarch: string } };
export const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** The next due date for a repeating task. */
export function nextDue(due: string, repeat: Repeat) {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(due);
  const d = new Date(allDay ? `${due}T12:00:00` : due);
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  else if (repeat === "weekly") d.setDate(d.getDate() + 7);
  else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  else if (repeat === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
  return allDay ? d.toISOString().slice(0, 10) : d.toISOString();
}
