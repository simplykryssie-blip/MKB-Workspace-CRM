"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowLeft, Building2, CheckCircle2, Circle, ClipboardList, KeyRound, Laptop, LogIn, Mail, ShieldAlert, ShieldCheck, UserCog, UserMinus, UserX, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { EmailInput, PhoneInput } from "@/components/ui/FormattedInputs";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/lib/store/clients-store";
import { useTax } from "@/lib/store/tax-store";
import { useBooks } from "@/lib/store/books-store";
import { useBiz } from "@/lib/store/biz-store";
import { useExp } from "@/lib/store/exp-store";
import { roleOf, useTeam, effectiveSensitive } from "@/lib/store/team-store";
import { DEPARTMENTS, HIGH_IMPACT, OFFBOARDING, ONBOARDING, SCOPE_META, SENSITIVE_GROUPS, deptLabel, sensitiveLabel, type DeptKey } from "@/lib/team/config";
import { fmtDate, fmtDateTime, relTime } from "@/lib/format";
import type { AssignmentRole } from "@/lib/expunge/config";
import { PreviewNote } from "./AccessGuard";
import { ConfirmDialog, Initials, LockedNote, RolePreview, StatusBadge, memberHref } from "./TeamParts";

export function MemberPage({ id }: { id: string }) {
  const team = useTeam();
  const toast = useToast();
  const m = team.members.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [roleTo, setRoleTo] = useState<string | null>(null);
  const [grant, setGrant] = useState<string | null>(null);
  const [suspend, setSuspend] = useState(false);
  if (!team.can("team", "view")) return null;
  if (!m) return <Card className="p-10 text-center"><p className="text-muted">Team member not found.</p><Button className="mt-4" href="/team#directory">Back to the directory</Button></Card>;
  const role = roleOf(team.roles, m);
  const manage = team.canManage(m.id, "assign");
  const manageEdit = team.canManage(m.id);
  const manageArchive = team.canManage(m.id, "archive");
  const isSelf = team.me?.id === m.id;
  const why = isSelf ? "You can't change your own access." : role?.isOwner ? "The Owner's access can't be changed by anyone else." : "You can only manage team members below your own role.";
  const eff = new Set<string>(effectiveSensitive(team, m));
  const manager = team.members.find((x) => x.id === m.managerId);
  const activity = team.audit.filter((e) => e.actorId === m.id || e.resource.includes(m.name)).slice(0, 12);
  const toRole = team.roles.find((r) => r.id === roleTo);
  return (
    <>
      <Link href="/team#directory" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-accent"><ArrowLeft size={15} /> Team directory</Link>
      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <Initials text={m.initials} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-bold text-ink">{m.name}</h1><StatusBadge s={m.status} />{isSelf && <Badge tone="info">You</Badge>}</div>
            <p className="text-[13.5px] text-muted">{m.title} · {role?.name} · {m.departments.map(deptLabel).join(", ") || "No department"}</p>
            <p className="text-[13px] text-ink-2">{m.email} · {m.phone || "No phone"}{manager ? ` · reports to ${manager.name}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(manageEdit || isSelf) && m.status !== "deactivated" && <Button icon={UserCog} onClick={() => setEdit(true)}>Edit profile</Button>}
            {manageArchive && m.status === "active" && <Button icon={UserX} onClick={() => setSuspend(true)}>Suspend</Button>}
            {manageArchive && m.status === "suspended" && !m.offboarding && <Button onClick={() => { team.reactivate(m.id); toast(`${m.name} reactivated`); }}>Reactivate</Button>}
            {manageArchive && m.status !== "deactivated" && m.status !== "invited" && !m.offboarding && <Button variant="ghost" icon={UserMinus} onClick={() => { team.startOffboarding(m.id); toast("Offboarding started"); }}>Start offboarding</Button>}
          </div>
        </div>
        {!manage && !isSelf && <div className="px-5 pb-4 sm:px-6"><LockedNote text={why} /></div>}
        {m.status === "deactivated" && <div className="px-5 pb-4 sm:px-6"><LockedNote text="Deactivated — this person can't sign in. Their historical work, notes and audit history are preserved; team members with history are never deleted." /></div>}
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {m.offboarding && <Offboarding id={m.id} />}

          <Card>
            <CardHeader icon={ShieldCheck} title="Role & access" subtitle={role ? SCOPE_META[role.scope].label : undefined} action={manage && m.status !== "deactivated" && (
              <select aria-label="Change role" value="" onChange={(e) => setRoleTo(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink">
                <option value="">Change role…</option>
                {team.assignableRoles().filter((r) => r.id !== m.roleId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )} />
            <div className="border-t border-line p-5 sm:px-6">{role && <RolePreview role={role} />}</div>
          </Card>

          <Card>
            <CardHeader icon={Building2} title="Departments" subtitle="Each department is separate — membership never grants access to another department" />
            <div className="flex flex-wrap gap-1.5 border-t border-line p-5 sm:px-6">
              {DEPARTMENTS.map((d) => {
                const on = m.departments.includes(d.key);
                return <button key={d.key} type="button" aria-pressed={on} disabled={!manage || m.status === "deactivated"} onClick={() => { const next: DeptKey[] = on ? m.departments.filter((x) => x !== d.key) : [...m.departments, d.key]; team.setDepartments(m.id, next); toast(`${on ? "Removed from" : "Added to"} ${d.label}`); }} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium disabled:cursor-default ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{d.label}</button>;
              })}
            </div>
          </Card>

          <Card>
            <CardHeader icon={ShieldAlert} title="Sensitive information" subtitle="Granted individually or by role. Department membership is still required. Every reveal, edit or download is logged." />
            <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2 sm:px-6">
              {SENSITIVE_GROUPS.map((g) => (
                <div key={g.key}>
                  <p className="mb-1.5 text-[13px] font-semibold text-ink">{g.label}{!m.departments.includes(g.dept) && !role?.allDepartments && <span className="font-normal text-muted"> · not in {deptLabel(g.dept)}</span>}</p>
                  <ul className="space-y-1">
                    {g.perms.map((p) => {
                      const fromRole = !!role?.sensitive.includes(p.key);
                      const granted = m.grants.includes(p.key);
                      const active = eff.has(p.key);
                      const canToggle = !fromRole && (granted ? manage : team.canGrant(m.id, p.key));
                      return (
                        <li key={p.key} className="flex items-center gap-2 text-[13px]">
                          {active ? <CheckCircle2 size={15} className="shrink-0 text-success" /> : <Circle size={15} className="shrink-0 text-faint" />}
                          <span className={`flex-1 ${active ? "text-ink" : "text-muted"}`}>{p.label}</span>
                          {fromRole ? <span className="text-[11.5px] text-muted">from role</span> : granted ? <Badge tone="info">Granted</Badge> : null}
                          {canToggle && m.status !== "deactivated" && <Button size="sm" variant="ghost" aria-label={`${granted ? "Remove" : "Grant"} ${sensitiveLabel(p.key)}`} onClick={() => (granted ? (team.setGrant(m.id, p.key, false), toast("Permission removed")) : HIGH_IMPACT.has(p.key) ? setGrant(p.key) : (team.setGrant(m.id, p.key, true), toast("Permission granted")))}>{granted ? "Remove" : "Grant"}</Button>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5 sm:px-6"><p className="text-[12px] text-muted">You can only grant permissions you hold yourself.</p></div>
          </Card>

          <AssignedRecords id={m.id} />
        </div>

        <div className="space-y-5">
          <Onboarding id={m.id} />
          <Card>
            <CardHeader icon={Laptop} title="Sessions" subtitle={`MFA: ${m.mfa === "enabled" ? "enabled" : "not enrolled"}`} action={(manageArchive || isSelf) && m.sessions.some((s) => !s.revokedAt) && <Button size="sm" onClick={() => { team.revokeSession(m.id); toast("All sessions revoked"); }}>Revoke all</Button>} />
            <ul className="divide-y divide-line border-t border-line">
              {m.sessions.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">No sessions.</li>}
              {m.sessions.map((s) => <li key={s.id} className="flex items-center gap-2 px-5 py-2.5 text-[13px]"><div className="min-w-0 flex-1"><div className="font-medium text-ink">{s.device}</div><div className="text-[12px] text-muted">{s.location} · active {relTime(s.lastActiveAt)}</div></div>{s.revokedAt ? <Badge tone="neutral">Revoked</Badge> : (manageArchive || isSelf) && <Button size="sm" variant="ghost" onClick={() => { team.revokeSession(m.id, s.id); toast("Session revoked"); }}>Revoke</Button>}</li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={LogIn} title="Recent sign-ins" />
            <ul className="divide-y divide-line border-t border-line">
              {m.logins.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">No sign-ins yet.</li>}
              {m.logins.slice(0, 6).map((l, i) => <li key={i} className="flex items-center gap-2 px-5 py-2 text-[13px]"><span className="flex-1 text-ink-2">{fmtDateTime(l.at)} · {l.device}</span>{l.success ? <Badge tone="success">Success</Badge> : <Badge tone="danger">{l.reason ?? "Failed"}</Badge>}</li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={KeyRound} title="Access review" subtitle={m.lastAccessReviewAt ? `Last reviewed ${fmtDate(m.lastAccessReviewAt)}` : "Never reviewed"} action={manage && m.status === "active" && <Button size="sm" onClick={() => { team.markReviewed(m.id); toast("Access review recorded"); }}>Mark reviewed</Button>} />
          </Card>
          {team.cap("audit.view") && (
            <Card>
              <CardHeader icon={Activity} title="Activity" />
              <ul className="divide-y divide-line border-t border-line">
                {activity.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">No activity.</li>}
                {activity.map((e) => <li key={e.id} className="px-5 py-2 text-[12.5px]"><div className="flex items-center gap-2"><Badge tone={e.success ? "neutral" : "danger"}>{e.action}</Badge><span className="ml-auto text-muted">{relTime(e.at)}</span></div><div className="mt-0.5 text-ink-2">{e.resource}</div></li>)}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <div className="mt-5"><PreviewNote /></div>

      <ConfirmDialog open={!!roleTo} title={`Change ${m.name}'s role to ${toRole?.name}?`} changes={[`${role?.name} → ${toRole?.name}`, toRole ? `Records: ${SCOPE_META[toRole.scope].label}` : "", ...(toRole && role && toRole.level > role.level ? ["This increases their access."] : [])].filter(Boolean)} onConfirm={() => { if (roleTo && team.changeRole(m.id, roleTo)) toast(`Role changed to ${toRole?.name}`); else toast("Not allowed"); }} onClose={() => setRoleTo(null)} />
      <ConfirmDialog open={!!grant} title={`Grant ${grant ? sensitiveLabel(grant) : ""}?`} changes={[`${m.name} will be able to: ${grant ? sensitiveLabel(grant) : ""}`, "Every use is recorded in the audit log."]} onConfirm={() => { if (grant && team.setGrant(m.id, grant, true)) toast("Permission granted"); }} onClose={() => setGrant(null)} />
      <SuspendDialog open={suspend} name={m.name} onClose={() => setSuspend(false)} onConfirm={(r) => { team.suspend(m.id, r); toast(`${m.name} suspended — sessions revoked`); }} />
      <EditProfile open={edit} id={m.id} onClose={() => setEdit(false)} />
    </>
  );
}

function SuspendDialog({ open, name, onClose, onConfirm }: { open: boolean; name: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [r, setR] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={`Suspend ${name}?`} description="They can't sign in and all active sessions are revoked. Nothing is deleted." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!r.trim()} onClick={() => { onConfirm(r.trim()); setR(""); onClose(); }}>Suspend account</Button></>}>
      <TextArea id="sp-reason" label="Reason (recorded in the audit log)" required value={r} onChange={(e) => setR(e.target.value)} />
    </Modal>
  );
}

function EditProfile({ open, id, onClose }: { open: boolean; id: string; onClose: () => void }) {
  const team = useTeam();
  const toast = useToast();
  const m = team.members.find((x) => x.id === id)!;
  const [v, setV] = useState({ name: m.name, title: m.title, email: m.email, phone: m.phone, managerId: m.managerId ?? "" });
  const canMgr = team.canManage(id, "assign");
  return (
    <Modal open={open} onClose={onClose} title="Edit profile" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!v.name.trim()} onClick={() => { team.updateProfile(id, { name: v.name.trim(), title: v.title.trim(), email: v.email.trim(), phone: v.phone, ...(canMgr ? { managerId: v.managerId || undefined } : {}) }); toast("Profile saved"); onClose(); }}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="ep-name" label="Full name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <TextField id="ep-title" label="Job title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        <EmailInput id="ep-email" label="Work email" value={v.email} onChange={(x) => setV({ ...v, email: x })} />
        <PhoneInput id="ep-phone" label="Phone" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
        {canMgr && <SelectField id="ep-mgr" label="Manager" value={v.managerId} onChange={(e) => setV({ ...v, managerId: e.target.value })} options={[["", "No manager"], ...team.members.filter((x) => x.id !== id && x.status === "active").map((x) => [x.id, x.name] as [string, string])]} />}
      </div>
    </Modal>
  );
}

function Onboarding({ id }: { id: string }) {
  const team = useTeam();
  const m = team.members.find((x) => x.id === id)!;
  const can = team.canManage(id);
  const done = ONBOARDING.filter((s) => m.onboarding[s]).length;
  return (
    <Card>
      <CardHeader icon={ClipboardList} title="Onboarding" subtitle={`${done} of ${ONBOARDING.length} complete`} />
      <div className="mx-5 mb-2 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-success" style={{ width: `${(done / ONBOARDING.length) * 100}%` }} /></div>
      <ul className="px-3 pb-4">
        {ONBOARDING.map((s) => {
          const at = m.onboarding[s];
          return (
            <li key={s}>
              <button type="button" disabled={!can || m.status === "deactivated"} onClick={() => team.toggleOnboarding(id, s)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface-hover disabled:cursor-default disabled:hover:bg-transparent" aria-pressed={!!at}>
                {at ? <CheckCircle2 size={16} className="shrink-0 text-success" /> : <Circle size={16} className="shrink-0 text-faint" />}
                <span className={`flex-1 ${at ? "text-ink" : "text-ink-2"}`}>{s}</span>
                {at && <span className="text-[11.5px] text-muted">{fmtDate(at)}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Everything this member is currently assigned to across the suite. */
function useAssignments(id: string) {
  const clients = useClients();
  const tax = useTax();
  const books = useBooks();
  const biz = useBiz();
  const exp = useExp();
  return useMemo(() => {
    const name = (cid?: string) => clients.clients.find((c) => c.id === cid)?.name ?? "Client";
    const clientRows = clients.clients.filter((c) => c.staffIds.includes(id)).map((c) => ({ key: `c:${c.id}`, label: c.name, href: `/clients/${c.id}` }));
    const tasks = [
      ...tax.returns.flatMap((r) => (["preparer", "reviewer"] as const).filter((k) => (k === "preparer" ? r.preparerId : r.reviewerId) === id).map((k) => ({ key: `tax:${r.id}:${k}`, label: `${name(r.clientId)} — ${r.taxYear} tax return (${k})`, href: `/services/tax-preparation/returns/${r.id}`, kind: "tax" as const, ref: r.id, role: k }))),
      ...books.workspaces.flatMap((w) => (["bookkeeper", "reviewer"] as const).filter((k) => (k === "bookkeeper" ? w.bookkeeperId : w.reviewerId) === id).map((k) => ({ key: `books:${w.id}:${k}`, label: `${name(w.clientId)} — bookkeeping (${k})`, href: `/services/bookkeeping/${w.id}`, kind: "books" as const, ref: w.id, role: k }))),
      ...biz.requests.flatMap((r) => (["assignedTo", "reviewerId"] as const).filter((k) => r[k] === id).map((k) => ({ key: `biz:${r.id}:${k}`, label: `${name(r.clientId)} — business request ${r.number} (${k === "assignedTo" ? "assigned" : "reviewer"})`, href: `/services/business-services/requests/${r.id}`, kind: "biz" as const, ref: r.id, role: k }))),
      ...exp.cases.filter((c) => c.assignedTo === id).map((c) => ({ key: `case:${c.id}`, label: `${name(c.clientId)} — expungement case ${c.number}`, href: `/services/record-expungement/cases/${c.id}`, kind: "case" as const, ref: c.id, role: "" })),
      ...exp.matters.flatMap((mt) => (Object.entries(mt.assignments) as [AssignmentRole, string][]).filter(([, v]) => v === id).map(([k]) => ({ key: `matter:${mt.id}:${k}`, label: `${name(mt.clientId)} — expungement matter (${k})`, href: `/services/record-expungement/matters/${mt.id}`, kind: "matter" as const, ref: mt.id, role: k }))),
    ];
    const reassign = (to: string, what: "clients" | "tasks") => {
      if (what === "clients") clients.clients.filter((c) => c.staffIds.includes(id)).forEach((c) => clients.updateClient(c.id, { staffIds: [...new Set(c.staffIds.map((s) => (s === id ? to : s)))] }, "Team assignment changed (offboarding)"));
      else
        tasks.forEach((t) => {
          if (t.kind === "tax") tax.assign(t.ref, t.role as "preparer", to);
          if (t.kind === "books") books.assign(t.ref, t.role as "bookkeeper", to);
          if (t.kind === "biz") biz.assign(t.ref, t.role as "assignedTo", to);
          if (t.kind === "case") exp.assignCase(t.ref, to);
          if (t.kind === "matter") exp.assign(t.ref, t.role as AssignmentRole, to);
        });
    };
    return { clientRows, tasks, reassign };
  }, [id, clients, tax, books, biz, exp]);
}

function AssignedRecords({ id }: { id: string }) {
  const team = useTeam();
  const clients = useClients();
  const toast = useToast();
  const m = team.members.find((x) => x.id === id)!;
  const role = roleOf(team.roles, m);
  const { clientRows, tasks } = useAssignments(id);
  const [pick, setPick] = useState("");
  const manage = team.canManage(id, "assign");
  return (
    <Card>
      <CardHeader icon={Users} title="Assigned records" subtitle={role ? SCOPE_META[role.scope].note : undefined} />
      <div className="space-y-4 border-t border-line p-5 sm:px-6">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink">Client team assignments ({clientRows.length})</p>
          <ul className="flex flex-wrap gap-1.5">{clientRows.length === 0 ? <li className="text-[13px] text-muted">None</li> : clientRows.map((c) => <li key={c.key}><Link href={c.href} className="inline-block rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-2 hover:border-accent">{c.label}</Link></li>)}</ul>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink">Work items ({tasks.length})</p>
          <ul className="space-y-1">{tasks.length === 0 ? <li className="text-[13px] text-muted">None</li> : tasks.map((t) => <li key={t.key}><Link href={t.href} className="text-[13px] text-ink-2 hover:text-accent">{t.label}</Link></li>)}</ul>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink">Individually selected records ({m.selectedClientIds.length}){role?.scope === "selected" && <span className="font-normal text-muted"> — the only clients this role can open</span>}</p>
          <ul className="flex flex-wrap gap-1.5">
            {m.selectedClientIds.map((cid) => <li key={cid} className="inline-flex items-center gap-1 rounded-full border border-line py-0.5 pl-3 pr-1 text-[12.5px] text-ink-2">{clients.clients.find((c) => c.id === cid)?.name ?? cid}{manage && <button aria-label="Remove record" onClick={() => { team.setSelectedClients(id, m.selectedClientIds.filter((x) => x !== cid)); toast("Record removed"); }} className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-surface-hover">×</button>}</li>)}
            {m.selectedClientIds.length === 0 && <li className="text-[13px] text-muted">None</li>}
          </ul>
          {manage && m.status !== "deactivated" && (
            <div className="mt-2 flex gap-2">
              <select aria-label="Add record" value={pick} onChange={(e) => setPick(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink"><option value="">Add a client record…</option>{clients.clients.filter((c) => !m.selectedClientIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <Button size="sm" disabled={!pick} onClick={() => { team.setSelectedClients(id, [...m.selectedClientIds, pick]); setPick(""); toast("Record added"); }}>Add</Button>
            </div>
          )}
          <p className="mt-1 text-[12px] text-muted">A URL or record ID never grants access — the record must be assigned, selected or within the role&rsquo;s scope.</p>
        </div>
      </div>
    </Card>
  );
}

function Offboarding({ id }: { id: string }) {
  const team = useTeam();
  const toast = useToast();
  const m = team.members.find((x) => x.id === id)!;
  const { clientRows, tasks, reassign } = useAssignments(id);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const can = team.canManage(id, "archive");
  const ob = m.offboarding!;
  const pendingApprovals = team.requests.filter((r) => r.status === "pending" && r.memberId === id).length;
  const targets = team.members.filter((x) => x.id !== id && x.status === "active");
  const finalStep = "Record offboarding date and administrator";
  const ready = OFFBOARDING.every((s) => s === finalStep || ob.steps[s]);
  const run = (s: (typeof OFFBOARDING)[number]) => {
    if (s === "Reassign clients" || s === "Reassign open tasks") {
      if (!to) return toast("Choose who receives the work first");
      reassign(to, s === "Reassign clients" ? "clients" : "tasks");
      team.offboardStep(id, s, `to ${team.members.find((x) => x.id === to)?.name}`);
    } else team.offboardStep(id, s, note || undefined);
    toast(`${s} — done`);
  };
  const detail: Partial<Record<(typeof OFFBOARDING)[number], string>> = {
    "Suspend account": "Blocks sign-in",
    "Revoke active sessions": `${m.sessions.filter((s) => !s.revokedAt).length} active`,
    "Remove department access": `${m.departments.length} department(s), ${m.grants.length} grant(s)`,
    "Reassign clients": `${clientRows.length} client(s)`,
    "Reassign open tasks": `${tasks.length} work item(s)`,
    "Review outstanding approvals": `${pendingApprovals} pending request(s)`,
    "Preserve historical activity": "Notes, audit history and completed work stay attributed to this person",
  };
  return (
    <Card className="border-warning/50">
      <CardHeader icon={UserMinus} title={ob.completedAt ? "Offboarding complete" : "Offboarding"} subtitle={`Started ${fmtDate(ob.startedAt)} by ${team.members.find((x) => x.id === ob.byId)?.name ?? "—"}${ob.completedAt ? ` · completed ${fmtDate(ob.completedAt)}` : ""}`} />
      <div className="space-y-3 border-t border-line p-5 sm:px-6">
        {!ob.completedAt && can && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField id="ob-to" label="Reassign work to" value={to} onChange={(e) => setTo(e.target.value)} options={[["", "Choose a team member…"], ...targets.map((x) => [x.id, `${x.name} (${roleOf(team.roles, x)?.name})`] as [string, string])]} />
            <TextField id="ob-note" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
        <ol className="space-y-1.5">
          {OFFBOARDING.map((s, i) => {
            const at = ob.steps[s];
            return (
              <li key={s} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 ring-1 ring-line">
                {at ? <CheckCircle2 size={16} className="shrink-0 text-success" /> : <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-line text-[10px] text-muted">{i + 1}</span>}
                <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium text-ink">{s}</div><div className="text-[12px] text-muted">{at ? `Done ${fmtDateTime(at)}` : detail[s]}</div></div>
                {!at && can && s !== finalStep && <Button size="sm" onClick={() => run(s)}>{s.startsWith("Reassign") ? "Reassign" : "Mark done"}</Button>}
              </li>
            );
          })}
        </ol>
        {!ob.completedAt && can && <Button variant="primary" disabled={!ready} onClick={() => { if (team.completeOffboarding(id)) toast(`${m.name} deactivated — history preserved`); }}>Complete offboarding & deactivate</Button>}
        {!ready && !ob.completedAt && <p className="text-[12px] text-muted">Complete every step to deactivate the account. The account is never deleted.</p>}
      </div>
    </Card>
  );
}

export { Mail };
