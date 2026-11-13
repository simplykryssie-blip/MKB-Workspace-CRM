/**
 * Monarch Tax Suite — the service bureau workspace. Shared by the server and
 * the staff screens. Money is in cents. Nothing here connects to tax software
 * or banks: bank numbers come from reports staff upload.
 */

export const STAGES = [
  { key: "interested", label: "Interested" },
  { key: "paid", label: "Paid" },
  { key: "collecting", label: "Collecting documents" },
  { key: "setup", label: "Setting up" },
  { key: "active", label: "Active" },
] as const;
export type Stage = (typeof STAGES)[number]["key"] | "inactive";
export const stageLabel = (s: Stage) => (s === "inactive" ? "Inactive" : STAGES.find((x) => x.key === s)!.label);
export const stageIndex = (s: Stage) => (s === "inactive" ? -1 : STAGES.findIndex((x) => x.key === s));

/** Who does a checklist item: the office (through the upload link) or Monarch staff. */
export type ItemWho = "office" | "staff";
/** How the office completes an item on the link. */
export type ItemKind = "sign" | "upload" | "locations" | "preparers" | "staff";
export type ItemDef = { key: string; label: string; who: ItemWho; kind: ItemKind; help: string };

export type ItemStatus = "open" | "review" | "done" | "na";
export type ItemState = { status: ItemStatus; at?: string; by?: string; note?: string; date?: string; sentAt?: string };

export type Location = { id: string; name: string; address: string; manager: string; efin: string; ownEfin: boolean; seats: number };
export type Preparer = { id: string; name: string; ptin: string; locationId: string };

export type Package = { id: string; name: string; kind: "package" | "seat" | "location" | "other"; priceCents: number; billing: "season" | "once" | "monthly"; locations: number; seats: number; askPtins: boolean; features: string[]; /** Stripe payment link on the website (buy.stripe.com/…); a purchase through it adds the office. */ stripeLink: string; /** Sets the office's software / bank when bought. */ softwareId?: string; bankId?: string; active: boolean };
export type Software = { id: string; name: string; sbFeeCents: number; downloadUrl: string; /** The software company's onboarding application for a new office. */ applicationUrl: string; welcomeSubject: string; welcomeBody: string; active: boolean };
export type Bank = { id: string; name: string; addonFeeCents: number; applicationUrl: string; layouts: Partial<Record<ReportType, Layout>>; active: boolean };
export type Reseller = { id: string; name: string; contact: string; email: string; phone: string; rateBp: number; notes: string; active: boolean };

export type ReportType = "enrollment" | "funded";
/** Which CSV column holds each value (column header text). */
export type Layout = { efin: string; name?: string; status?: string; count?: string; fees?: string };

export type LinkState = "none" | "on" | "off" | "expired";
export type OfficeFile = { id: string; item: string; name: string; sizeKb: number; by: "office" | "staff"; at: string };
export type BankStatus = { enrollment?: string; enrollmentAt?: string; funded?: number; feesCents?: number; fundedAt?: string };

export type Office = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  stage: Stage;
  packageId?: string;
  softwareId?: string;
  bankId?: string;
  resellerId?: string;
  softwareUsername: string;
  renewsOn?: string;
  extraSeats: number;
  extraLocations: number;
  notes: string;
  checklist: Record<string, ItemState>;
  locations: Location[];
  preparers: Preparer[];
  agreement?: { name: string; at: string; fileId: string };
  link: { state: LinkState; sentAt?: string; lastUsed?: string; expiresAt?: string };
  /** When the automatic welcome email went out. */
  welcomeSentAt?: string;
  files: OfficeFile[];
  bank: BankStatus;
  createdAt: string;
  updatedAt: string;
  rev: number;
};

export type Sale = { id: string; officeId: string; packageId?: string; description: string; qty: number; unitCents: number; amountCents: number; status: "unpaid" | "paid" | "refunded" | "void"; method?: string; paidAt?: string; refundedAt?: string; linkSentAt?: string; resellerId?: string; createdAt: string };
export type Commission = { id: string; resellerId: string; saleId: string; rateBp: number; amountCents: number; status: "owed" | "paid" | "cancelled"; paidAt?: string; createdAt: string };
export type BankUpload = { id: string; bankId: string; reportType: ReportType; fileName: string; rows: number; matched: number; createdAt: string };
export type UnmatchedRow = { efin: string; name: string; bankId: string; reportType: ReportType; funded: number; feesCents: number };

export type MonarchSettings = {
  /** Upload links stop working after this many days without use. */
  linkDays: number;
  /** Turn the link off once the office is Active. */
  closeOnActive: boolean;
  /** Email the welcome (setup link + software and bank applications) as soon as a package is paid. */
  autoWelcome: boolean;
  phone: string;
  email: string;
  agreement: { text: string; version: number };
};

export type MonarchData = {
  settings: MonarchSettings;
  packages: Package[];
  software: Software[];
  banks: Bank[];
  resellers: Reseller[];
  offices: Office[];
  sales: Sale[];
  commissions: Commission[];
  uploads: BankUpload[];
  unmatched: UnmatchedRow[];
  stripe: boolean;
};

export const DEFAULT_AGREEMENT = `MONARCH TAX SUITE — SERVICE BUREAU AGREEMENT

This agreement is between Monarch Tax Suite ("Monarch") and the tax office named below ("Office").

## What Monarch provides
- Access to the tax software package the Office purchased, for the season it was purchased for.
- Setup of the Office's software account and help enrolling in bank products.
- Support during the filing season.

## What the Office agrees to
- Keep a valid EFIN and PTIN for every preparer, and follow IRS rules for e-file providers (Publication 1345).
- Keep client information secure and confidential.
- Pay for the package and any add-ons before the software account is activated.
- Service bureau fees are added to bank products as listed in the Office's package.

## Term
This agreement covers the current filing season and renews when the Office renews its package.

Edit this text in Monarch → Setup before sending your first upload link.`;

export const DEFAULT_SETTINGS: MonarchSettings = { linkDays: 30, closeOnActive: true, autoWelcome: true, phone: "", email: "", agreement: { text: DEFAULT_AGREEMENT, version: 1 } };

/** The onboarding checklist for one office (depends on its package and bank). */
export function checklistFor(o: Pick<Office, "bankId" | "softwareId">, pkg: Package | undefined, bank: Bank | undefined, software: Software | undefined): ItemDef[] {
  const bankName = bank?.name ?? "Bank";
  const swName = software?.name ?? "Software";
  return [
    { key: "agreement", label: "Service bureau agreement", who: "office", kind: "sign", help: "Read and sign the agreement online." },
    { key: "photo_id", label: "Photo ID", who: "office", kind: "upload", help: "Driver's license or state ID of the office owner. A clear photo or PDF." },
    { key: "business_docs", label: "EIN letter / business documents", who: "office", kind: "upload", help: "IRS EIN letter (CP 575 or 147C) and business registration." },
    { key: "locations", label: "Office locations", who: "office", kind: "locations", help: "Each location you'll file from, its manager and its EFIN." },
    { key: "efin_letters", label: "EFIN acceptance letters", who: "office", kind: "upload", help: "The IRS letter for each EFIN you'll use. PDF or a clear photo." },
    ...(pkg?.askPtins ? [{ key: "preparers", label: "Preparers & PTINs", who: "office" as const, kind: "preparers" as const, help: "Everyone who will prepare returns, with their PTIN." }] : []),
    { key: "bank_app", label: `${bankName} application`, who: "office", kind: "upload", help: `Fill out the ${bankName} application from the link we emailed you, then upload your completed copy here.` },
    { key: "bank_approved", label: `${bankName} enrollment approved`, who: "staff", kind: "staff", help: `Checks itself off when a ${bankName} enrollment report shows "Approved".` },
    { key: "software_account", label: `${swName} account created`, who: "staff", kind: "staff", help: "Create their account, then record the username here." },
    { key: "welcome", label: "Software welcome email", who: "staff", kind: "staff", help: "Download link and username. Passwords are never emailed." },
    { key: "walkthrough", label: "Setup walkthrough", who: "staff", kind: "staff", help: "A setup call or visit with the office." },
  ];
}

export const itemState = (o: Pick<Office, "checklist">, key: string): ItemState => o.checklist[key] ?? { status: "open" };
export const isDone = (s: ItemState) => s.status === "done" || s.status === "na";

export function progress(o: Office, items: ItemDef[]) {
  const done = items.filter((i) => isDone(itemState(o, i.key))).length;
  return { done, total: items.length };
}

/** What the package includes plus add-ons bought. */
export function capacity(o: Office, pkg: Package | undefined) {
  return { locations: (pkg?.locations ?? 0) + o.extraLocations, seats: (pkg?.seats ?? 0) + o.extraSeats, usedLocations: o.locations.length, usedSeats: o.locations.reduce((n, l) => n + (l.seats || 0), 0) };
}

export const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
export const pct = (bp: number) => `${(bp / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
export const BILLING_LABEL: Record<Package["billing"], string> = { season: "per season", once: "one time", monthly: "per month" };
export const KIND_LABEL: Record<Package["kind"], string> = { package: "Package", seat: "Extra seat", location: "Extra location", other: "Other" };
