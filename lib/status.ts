import type { Tone } from "@/components/ui/Badge";
import type { ClientStatus, DocStatus, Enrollment, InvoiceStatus, PortalStatus, Signature } from "@/lib/types";

export const clientStatus: Record<ClientStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  onboarding: { label: "Onboarding", tone: "info" },
  inactive: { label: "Inactive", tone: "neutral" },
};
export const portalStatus: Record<PortalStatus, { label: string; tone: Tone }> = {
  active: { label: "Portal active", tone: "success" },
  invited: { label: "Invite sent", tone: "info" },
  not_invited: { label: "No portal access", tone: "neutral" },
};
export const enrollmentStatus: Record<Enrollment["status"], { label: string; tone: Tone }> = {
  active: { label: "In progress", tone: "info" },
  waiting_on_client: { label: "Waiting on client", tone: "warning" },
  in_review: { label: "In review", tone: "info" },
  complete: { label: "Complete", tone: "success" },
  on_hold: { label: "On hold", tone: "neutral" },
};
export const docStatus: Record<DocStatus, { label: string; tone: Tone }> = {
  requested: { label: "Requested", tone: "warning" },
  received: { label: "Received", tone: "info" },
  reviewed: { label: "Reviewed", tone: "success" },
  rejected: { label: "Needs re-upload", tone: "danger" },
};
export const invoiceStatus: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "info" },
  partial: { label: "Partially paid", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
  paid: { label: "Paid", tone: "success" },
};
export const signatureStatus: Record<Signature["status"], { label: string; tone: Tone }> = {
  pending: { label: "Awaiting signature", tone: "warning" },
  signed: { label: "Signed", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
};
