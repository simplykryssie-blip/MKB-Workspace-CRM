"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, Lock, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/lib/store/clients-store";
import { useBooks } from "@/lib/store/books-store";
import { useTax } from "@/lib/store/tax-store";
import { useTeam } from "@/lib/store/team-store";
import { MODULES, STATUS_META, type ModuleKey } from "@/lib/team/config";

/** Which permission module a route belongs to. */
export function moduleForPath(path: string): ModuleKey | null {
  const map: [string, ModuleKey][] = [
    ["/dashboard", "dashboard"],
    ["/clients", "crm"],
    ["/leads", "leads"],
    ["/forms", "leads"],
    ["/services/tax-preparation", "tax"],
    ["/services/bookkeeping", "books"],
    ["/services/business-services", "biz"],
    ["/services/record-expungement", "exp"],
    ["/appointments", "communication"],
    ["/messages", "communication"],
    ["/documents", "documents"],
    ["/invoices", "billing"],
    ["/tasks", "dashboard"],
    ["/team", "team"],
    ["/settings", "settings"],
    ["/website", "settings"],
  ];
  return map.find(([p]) => path === p || path.startsWith(`${p}/`))?.[1] ?? null;
}
export const moduleLabel = (k: ModuleKey) => MODULES.find((m) => m.key === k)!.label;

/** Portal routes a client may open: only their own. */
function clientPortalLinks(clientId: string, workspaces: { id: string; clientId: string; businessName: string }[], returns: { id: string; clientId: string; taxYear: number; form: string; status: string }[] = []) {
  return [
    ...returns.filter((r) => r.clientId === clientId && r.status !== "Completed").map((r) => ({ href: `/services/tax-preparation/returns/${r.id}/interview`, label: `Tax interview — ${r.taxYear} ${r.form}` })),
    { href: `/services/record-expungement/portal/${clientId}`, label: "Expungement" },
    { href: `/services/business-services/portal/${clientId}`, label: "Business services" },
    ...workspaces.filter((w) => w.clientId === clientId).map((w) => ({ href: `/services/bookkeeping/${w.id}/client`, label: `Bookkeeping — ${w.businessName}` })),
  ];
}

/** "Previewing as" switcher — a design-review tool, not authentication. */
export function PreviewSwitcher() {
  const team = useTeam();
  const { clients } = useClients();
  const value = team.acting.kind === "member" ? `m:${team.acting.id}` : `c:${team.acting.clientId}`;
  return (
    <label className="inline-flex min-w-0 items-center gap-1.5">
      <Eye size={13} className="shrink-0" />
      <span className="hidden sm:inline">Previewing as</span>
      <select aria-label="Previewing as" value={value} onChange={(e) => { const [k, id] = e.target.value.split(":"); team.setActing(k === "m" ? { kind: "member", id } : { kind: "client", clientId: id }); }} className="h-6 min-w-0 max-w-[200px] rounded-md border border-warning/40 bg-surface px-1 text-[12px] font-semibold text-ink sm:max-w-[260px]">
        <optgroup label="Team members">
          {team.members.filter((m) => m.status !== "deactivated" && m.status !== "invited").map((m) => <option key={m.id} value={`m:${m.id}`}>{m.name} — {team.roles.find((r) => r.id === m.roleId)?.name}{m.status === "suspended" ? " (suspended)" : ""}</option>)}
        </optgroup>
        <optgroup label="Client portal role">
          {clients.filter((c) => c.portal !== "not_invited").map((c) => <option key={c.id} value={`c:${c.id}`}>Client: {c.name}</option>)}
        </optgroup>
      </select>
    </label>
  );
}

export function RequestAccessDialog({ open, onClose, kind, target, label }: { open: boolean; onClose: () => void; kind: "module" | "record" | "sensitive"; target: string; label: string }) {
  const team = useTeam();
  const toast = useToast();
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Request access" description={label} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={Send} disabled={reason.trim().length < 10} onClick={() => { team.requestAccess({ kind, target, reason: reason.trim() }); toast("Access request sent for review"); onClose(); }}>Send request</Button></>}>
      <TextArea id="ra-reason" label="Why do you need access?" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the work this is for (at least 10 characters)." />
      <p className="mt-2 text-[12px] text-muted">An administrator reviews it. Sensitive information requests can only be approved by the Owner.</p>
    </Modal>
  );
}

export function NoAccess({ title, detail, request }: { title: string; detail: string; request?: { kind: "module" | "record" | "sensitive"; target: string; label: string } }) {
  const team = useTeam();
  const [open, setOpen] = useState(false);
  const pending = request && team.requests.some((r) => r.memberId === team.me?.id && r.target === request.target && r.status === "pending");
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning-soft text-warning-ink"><Lock size={22} /></span>
        <h1 className="mt-4 text-[20px] font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{detail}</p>
        {request && team.acting.kind === "member" && team.me?.status === "active" && (pending ? <p className="mt-4 text-[13px] font-semibold text-accent-ink">Your access request is pending review.</p> : <Button className="mt-5" variant="primary" icon={Send} onClick={() => setOpen(true)}>Request access</Button>)}
        {request && <RequestAccessDialog open={open} onClose={() => setOpen(false)} kind={request.kind} target={request.target} label={request.label} />}
      </div>
    </div>
  );
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND === "1";
/** Sections that still run on sample data (closed when the backend is on). */
const NOT_CONNECTED: [string, string][] = [
  ["/services/business-services", "Business Services"],
  ["/services/record-expungement", "Record Expungement"],
  ["/appointments", "Appointments"],
  ["/documents", "Documents"],
  ["/invoices", "Invoices & Payments"],
  ["/messages", "Messages"],
  ["/tasks", "Tasks"],
  ["/portal", "The client portal"],
];

/** Route-level guard: module permissions for team members; own-portal-only for clients. */
export function AccessGuard({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const team = useTeam();
  const { clients } = useClients();
  const books = useBooks();
  const tax = useTax();
  if (team.acting.kind === "client") {
    const cid = team.acting.clientId;
    const links = clientPortalLinks(cid, books.workspaces, tax.returns);
    const ok = links.some((l) => path === l.href);
    if (ok) return <>{children}</>;
    const name = clients.find((c) => c.id === cid)?.name;
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Lock size={22} /></span>
          <h1 className="mt-4 text-[20px] font-bold tracking-tight text-ink">Client portal only</h1>
          <p className="mt-2 text-[14px] text-muted">{name} can only open their own portal pages — never internal MKB screens, other clients or staff information.</p>
          <ul className="mt-4 space-y-1.5">{links.map((l) => <li key={l.href}><Link href={l.href} className="text-[14px] font-semibold text-accent hover:underline">{l.label}</Link></li>)}</ul>
        </div>
      </div>
    );
  }
  const me = team.me;
  if (!team.ready) return <div className="grid min-h-[50vh] place-items-center text-[14px] text-muted" role="status">Loading…</div>;
  if (!me || me.status !== "active")
    return <NoAccess title={`Account ${me ? STATUS_META[me.status].label.toLowerCase() : "not found"}`} detail="This account can't sign in. In production the authentication service blocks it before any page loads." />;
  // Modules not yet connected to the database would only show in-browser sample data
  // (and lose anything typed), so with the backend on they're closed until built.
  const notYet = BACKEND ? NOT_CONNECTED.find(([p]) => path === p || path.startsWith(`${p}/`)) : undefined;
  if (notYet)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent"><Lock size={22} /></span>
          <h1 className="mt-4 text-[20px] font-bold tracking-tight text-ink">{notYet[1]} isn&rsquo;t connected yet</h1>
          <p className="mt-2 text-[14px] text-muted">This section is being built. Until it&rsquo;s connected to the database, it stays closed so no real work is entered somewhere it can&rsquo;t be saved.</p>
          <Link href="/dashboard" className="mt-5 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-[14px] font-semibold text-white hover:bg-accent-hover">Back to dashboard</Link>
        </div>
      </div>
    );
  const mod = moduleForPath(path);
  if (mod && !team.can(mod))
    return <NoAccess title={`No access to ${moduleLabel(mod)}`} detail={`Your role (${team.myRole?.name}) and departments don't include ${moduleLabel(mod)}. Belonging to one department never grants access to another.`} request={{ kind: "module", target: mod, label: `${moduleLabel(mod)} — view access` }} />;
  return <>{children}</>;
}

/**
 * Record-level gate: knowing a client ID or URL never grants access.
 * Returns an element to render instead of the record, or null when allowed (and logs the access).
 */
export function useClientGate(clientId?: string, what = "this client's records") {
  const team = useTeam();
  const { clients } = useClients();
  const c = clients.find((x) => x.id === clientId);
  const ok = !c || team.clientAccess(c);
  const actorKey = team.acting.kind === "member" ? team.acting.id : team.acting.clientId;
  useEffect(() => {
    if (c && ok && team.acting.kind === "member") team.log({ action: "Client record access", resource: `Client ${c.id}`, meta: what });
    if (c && !ok && team.acting.kind === "member") team.log({ action: "Client record access", resource: `Client ${c.id}`, meta: `Denied — not in ${team.myRole?.name ?? "role"} scope`, success: false });
  }, [c?.id, actorKey, ok]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c || ok) return null;
  return <NoAccess title="Not assigned to you" detail={`Your access is limited to ${team.myRole?.scope === "selected" ? "individually selected records" : team.myRole?.scope === "assigned" ? "records assigned to you" : "your departments and team"}. Opening a link or ID directly doesn't grant access.`} request={{ kind: "record", target: `client:${c.id}`, label: `Access to ${what}` }} />;
}

export function PreviewNote() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-dashed border-line-strong px-3.5 py-2 text-[12.5px] text-muted">
      <ShieldAlert size={14} className="mt-0.5 shrink-0" />
      <span>Prototype only: these checks change what the interface shows for review. They are not security — the production backend must enforce every permission on every request, independently of the interface, and write the audit log server-side.</span>
    </p>
  );
}

export { clientPortalLinks };
