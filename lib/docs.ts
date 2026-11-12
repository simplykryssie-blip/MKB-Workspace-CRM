import type { ClientDocument } from "@/lib/types";

/** Requests are due 7 days after they're sent unless a different date was set. */
export const DEFAULT_DUE_DAYS = 7;
export const defaultDue = (d: Pick<ClientDocument, "requestedAt">) => new Date(Date.parse(d.requestedAt) + DEFAULT_DUE_DAYS * 86400000).toISOString();
/** The due date to show and sort by: the one set on the request, else the 7-day default (older requests had none). */
export const dueOf = (d: Pick<ClientDocument, "requestedAt" | "dueAt">) => d.dueAt ?? defaultDue(d);
