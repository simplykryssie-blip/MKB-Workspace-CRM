"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Activity, BadgeCheck, Building2, ChevronLeft, ChevronRight, ClipboardList, Copy, Download, GitCompare, KeyRound, LayoutGrid, Lock, Mail, Plus, RotateCcw, Search, Send, ShieldAlert, ShieldCheck, UserCheck, UserPlus, Users, UserX, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { EmailInput, PhoneInput } from "@/components/ui/FormattedInputs";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { Kpi } from "@/components/biz/BizBits";
import { useClients } from "@/lib/store/clients-store";
import { roleOf, useTeam } from "@/lib/store/team-store";
import { AUDIT_ACTIONS, CAPABILITIES, DEPARTMENTS, MODULES, MODULE_DEPT, OWNER_ONLY, SCOPE_META, SENSITIVE_GROUPS, SENSITIVITY, SENSITIVITY_META, WORKFLOW_LEVEL, WORKFLOW_PERMS, deptLabel, sensitiveLabel, type ActionKey, type DeptKey, type ModuleKey, type Role, type Scope, type Sensitivity } from "@/lib/team/config";
import { fmtDate, fmtDateTime, relTime } from "@/lib/format";
import { validateEmail } from "@/lib/validation";
import { SAMPLE_NOW } from "@/lib/sample/clients";
import { PreviewNote } from "./AccessGuard";
import { ConfirmDialog, Initials, LockedNote, PermissionMatrix, RecordTypeEditor, RolePreview, StatusBadge, memberHref, roleDiff } from "./TeamParts";

const TABS = [
  { key: "overview", label: "Team overview", icon: LayoutGrid },
  { key: "directory", label: "Team directory", icon: Users },
  { key: "roles", label: "Roles & permissions", icon: ShieldCheck },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "invitations", label: "Invitations", icon: Mail },
  { key: "requests", label: "Access requests", icon: KeyRound },
  { key: "audit", label: "Audit logs", icon: Activity },
  { key: "security", label: "Security settings", icon: Lock },
] as const;
type Tab = (typeof TABS)[number]["key"];
const REVIEW_DAYS = 90;
const reviewDue = (at?: string) => !at || (SAMPLE_NOW.getTime() - new Date(at).getTime()) / 86400000 > REVIEW_DAYS;

export function TeamCenter() {
  const team = useTeam();
  const [tab, setTab] = useState<Tab>("overview");
  const [invite, setInvite] = useState(false);
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((t) => t.key === h)) setTab(h);
  }, []);
  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `#${t}`); };
  const visible = TABS.filter((t) => (t.key === "audit" || t.key === "security" ? team.cap("audit.view") : true));
  const current = visible.some((t) => t.key === tab) ? tab : "overview";
  return (
    <>
      <PageHeader
        title="Team & Permissions"
        subtitle="Team members, roles, departments, sensitive-information access and the audit trail for the whole MKB Business Suite."
        actions={<>{team.can("team", "create") && <Button variant="primary" icon={UserPlus} onClick={() => setInvite(true)}>Invite team member</Button>}</>}
      />
      <div className="sticky top-16 z-20 -mx-4 mb-5 border-b border-line bg-bg/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-8 lg:px-8">
        <div role="tablist" aria-label="Team & Permissions" className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {visible.map((t) => (
            <button key={t.key} role="tab" aria-selected={current === t.key} onClick={() => go(t.key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium ${current === t.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>
              <t.icon size={16} /> {t.label}
              {t.key === "requests" && team.requests.some((r) => r.status === "pending") && <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-ink">{team.requests.filter((r) => r.status === "pending").length}</span>}
            </button>
          ))}
        </div>
      </div>
      {current === "overview" && <Overview go={go} />}
      {current === "directory" && <Directory onInvite={() => setInvite(true)} />}
      {current === "roles" && <Roles />}
      {current === "departments" && <Departments />}
      {current === "invitations" && <Invitations onInvite={() => setInvite(true)} />}
      {current === "requests" && <Requests />}
      {current === "audit" && <Audit />}
      {current === "security" && <Security />}
      <div className="mt-5"><PreviewNote /></div>
      <InviteDialog open={invite} onClose={() => setInvite(false)} />
    </>
  );
}

/* ================================================================== */

function Overview({ go }: { go: (t: Tab) => void }) {
  const team = useTeam();
  const live = team.members.filter((m) => m.status !== "deactivated");
  const due = team.members.filter((m) => m.status === "active" && reviewDue(m.lastAccessReviewAt));
  const pendingReq = team.requests.filter((r) => r.status === "pending").length;
  const byRole = team.roles.filter((r) => !r.isClient).map((r) => ({ r, n: live.filter((m) => m.roleId === r.id).length }));
  const byDept = DEPARTMENTS.map((d) => ({ d, n: live.filter((m) => m.departments.includes(d.key)).length }));
  const max = Math.max(1, ...byRole.map((x) => x.n), ...byDept.map((x) => x.n));
  const name = (id: string) => team.members.find((m) => m.id === id)?.name ?? "Former team member";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Kpi label="Total team members" value={team.members.length} sub={`${team.members.filter((m) => m.status === "deactivated").length} deactivated (history kept)`} icon={Users} onClick={() => go("directory")} />
        <Kpi label="Active members" value={team.members.filter((m) => m.status === "active").length} icon={UserCheck} tone="success" onClick={() => go("directory")} />
        <Kpi label="Pending invitations" value={team.invitations.filter((i) => i.status === "pending").length} icon={Mail} onClick={() => go("invitations")} />
        <Kpi label="Suspended accounts" value={team.members.filter((m) => m.status === "suspended").length} icon={UserX} tone="warning" onClick={() => go("directory")} />
        <Kpi label="Pending access reviews" value={due.length + pendingReq} sub={`${due.length} periodic · ${pendingReq} requests`} icon={KeyRound} tone={due.length + pendingReq ? "warning" : "success"} onClick={() => go("requests")} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader icon={ShieldCheck} title="Members by role" />
          <ul className="space-y-2 px-5 pb-5 sm:px-6">{byRole.map(({ r, n }) => <li key={r.id} className="text-[13px]"><div className="flex justify-between"><span className="text-ink">{r.name}{r.kind === "custom" && <span className="text-muted"> (custom)</span>}</span><span className="tabular-nums text-muted">{n}</span></div><div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-accent" style={{ width: `${(n / max) * 100}%` }} /></div></li>)}</ul>
        </Card>
        <Card>
          <CardHeader icon={Building2} title="Members by department" subtitle="A member can belong to several departments" />
          <ul className="space-y-2 px-5 pb-5 sm:px-6">{byDept.map(({ d, n }) => <li key={d.key} className="text-[13px]"><div className="flex justify-between"><span className="text-ink">{d.label}</span><span className="tabular-nums text-muted">{n}</span></div><div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-success" style={{ width: `${(n / max) * 100}%` }} /></div></li>)}</ul>
        </Card>
        <Card>
          <CardHeader icon={KeyRound} title="Access reviews due" subtitle={`Every ${REVIEW_DAYS} days per active member`} />
          <ul className="divide-y divide-line border-t border-line">
            {due.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">All access reviews are current.</li>}
            {due.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <Initials text={m.initials} size={30} />
                <div className="min-w-0 flex-1"><Link href={memberHref(m.id)} className="text-[13.5px] font-semibold text-ink hover:text-accent">{m.name}</Link><div className="text-[12px] text-muted">{roleOf(team.roles, m)?.name} · last reviewed {m.lastAccessReviewAt ? relTime(m.lastAccessReviewAt) : "never"}</div></div>
                <Button size="sm" disabled={!team.canManage(m.id)} onClick={() => team.markReviewed(m.id)}>Mark reviewed</Button>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader icon={Activity} title="Recent team activity" action={team.cap("audit.view") && <Button size="sm" variant="ghost" onClick={() => go("audit")}>Audit logs</Button>} />
          {team.cap("audit.view") ? (
            <ul className="divide-y divide-line border-t border-line">
              {team.audit.slice(0, 8).map((e) => <li key={e.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-[13px] sm:px-6"><Badge tone={e.success ? "neutral" : "danger"}>{e.action}</Badge><span className="font-medium text-ink">{name(e.actorId)}</span><span className="min-w-0 flex-1 truncate text-ink-2">{e.resource}</span><span className="text-[12px] text-muted">{relTime(e.at)}</span></li>)}
            </ul>
          ) : <div className="px-5 pb-5 sm:px-6"><LockedNote text="Detailed activity is visible to administrators and the Owner." /></div>}
        </Card>
      </div>
    </div>
  );
}

/* ================================================================== */

const PAGE = 8;
function Directory({ onInvite }: { onInvite: () => void }) {
  const team = useTeam();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"name" | "added" | "login">("name");
  const [page, setPage] = useState(0);
  const rows = team.members
    .filter((m) => (role === "all" || m.roleId === role) && (dept === "all" || m.departments.includes(dept as DeptKey)) && (status === "all" || m.status === status))
    .filter((m) => !q.trim() || `${m.name} ${m.email} ${m.title}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "added" ? b.addedAt.localeCompare(a.addedAt) : (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? "")));
  useEffect(() => setPage(0), [q, role, dept, status, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const sel = "h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2";
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 p-4 sm:px-6">
        <div className="relative min-w-[200px] flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or title…" aria-label="Search team" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink" /></div>
        <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className={sel}><option value="all">All roles</option>{team.roles.filter((r) => !r.isClient).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className={sel}><option value="all">All departments</option>{DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}><option value="all">All statuses</option><option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={sel}><option value="name">Sort: name</option><option value="added">Sort: date added</option><option value="login">Sort: last login</option></select>
        {team.can("team", "create") && <Button variant="primary" icon={UserPlus} onClick={onInvite}>Invite</Button>}
      </div>
      <p className="px-4 pb-2 text-[12.5px] text-muted sm:px-6">Showing {rows.length ? page * PAGE + 1 : 0}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}</p>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[1080px] text-left text-[13.5px]">
          <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted"><tr><th className="px-5 py-2.5">Name</th><th className="px-3 py-2.5">Phone</th><th className="px-3 py-2.5">Role</th><th className="px-3 py-2.5">Departments</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Added</th><th className="px-3 py-2.5">Last login</th><th className="px-3 py-2.5 pr-5">Manager</th></tr></thead>
          <tbody>
            {view.length === 0 && <tr><td colSpan={8} className="px-6 py-10 text-center text-muted">No team members match.</td></tr>}
            {view.map((m) => (
              <tr key={m.id} onClick={() => router.push(memberHref(m.id))} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover">
                <td className="px-5 py-2.5"><div className="flex items-center gap-3"><Initials text={m.initials} size={32} /><div className="min-w-0"><Link href={memberHref(m.id)} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-accent">{m.name}</Link><div className="truncate text-[12px] text-muted">{m.email}</div></div></div></td>
                <td className="px-3 py-2.5 text-ink-2">{m.phone}</td>
                <td className="px-3 py-2.5 text-ink-2">{roleOf(team.roles, m)?.name}</td>
                <td className="px-3 py-2.5 text-[12.5px] text-ink-2">{m.departments.map(deptLabel).join(", ") || "—"}</td>
                <td className="px-3 py-2.5"><StatusBadge s={m.status} /></td>
                <td className="px-3 py-2.5 text-ink-2">{fmtDate(m.addedAt)}</td>
                <td className="px-3 py-2.5 text-ink-2">{m.lastLoginAt ? relTime(m.lastLoginAt) : "Never"}</td>
                <td className="px-3 py-2.5 pr-5 text-ink-2">{team.members.find((x) => x.id === m.managerId)?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3 sm:px-6">
        <Button size="sm" icon={ChevronLeft} aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)} />
        <span className="text-[12.5px] text-muted">Page {page + 1} of {pages}</span>
        <Button size="sm" icon={ChevronRight} aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} />
      </div>
    </Card>
  );
}

/* ================================================================== */

function Roles() {
  const team = useTeam();
  const toast = useToast();
  const [sel, setSel] = useState(team.roles[0].id);
  const src = team.roles.find((r) => r.id === sel) ?? team.roles[0];
  const [v, setV] = useState<Role>(structuredClone(src));
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [view, setView] = useState<"edit" | "preview" | "compare">("edit");
  const [cmp, setCmp] = useState(team.roles[1].id);
  const [newName, setNewName] = useState<{ from: string } | null>(null);
  const [name, setName] = useState("");
  useEffect(() => setV(structuredClone(team.roles.find((r) => r.id === sel) ?? team.roles[0])), [sel, team.roles]);
  const editable = team.canEditRole(src.id);
  const isOwnerActor = !!team.myRole?.isOwner;
  const members = team.members.filter((m) => m.roleId === src.id);
  const diff = roleDiff(src, v);
  const toggle = (mod: string, act: string) => setV({ ...v, perms: { ...v.perms, [mod]: (v.perms[mod as ModuleKey] ?? []).includes(act as ActionKey) ? (v.perms[mod as ModuleKey] ?? []).filter((x) => x !== act) : [...(v.perms[mod as ModuleKey] ?? []), act as ActionKey] } });
  const save = () => { if (team.saveRole(v, diff.map((d) => d.text).join("; "))) toast(`${v.name} saved`); else toast("Not allowed — you can't grant more than you hold"); };
  const actorHas = (perm: string) => isOwnerActor || !!team.myRole?.sensitive.includes(perm);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="self-start">
        <CardHeader icon={ShieldCheck} title="Roles" action={team.cap("roles.manage") && <Button size="sm" icon={Plus} onClick={() => { setNewName({ from: "role-staff" }); setName(""); }}>Custom role</Button>} />
        <ul className="border-t border-line" aria-label="Roles">
          {team.roles.map((r) => (
            <li key={r.id}>
              <button aria-current={sel === r.id ? "true" : undefined} onClick={() => setSel(r.id)} className={`flex w-full items-center gap-2 px-5 py-2.5 text-left text-[13.5px] ${sel === r.id ? "bg-accent-soft" : "hover:bg-surface-hover"}`}>
                <span className="flex-1 font-medium text-ink">{r.name}</span>
                {r.kind === "custom" && <Badge tone="info">Custom</Badge>}
                {r.isOwner && <Lock size={13} className="text-muted" />}
                <span className="text-[12px] tabular-nums text-muted">{team.members.filter((m) => m.roleId === r.id && m.status !== "deactivated").length}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-5">
        <Card>
          <div className="flex flex-wrap items-center gap-2 p-5 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-bold text-ink">{src.name}</h2>
              <p className="text-[13px] text-muted">{src.description}</p>
            </div>
            <div role="radiogroup" aria-label="Role view" className="inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-line">
              {([["edit", "Permissions"], ["preview", "Access preview"], ["compare", "Compare"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={view === k} onClick={() => setView(k)} className={`h-8 rounded-lg px-3 text-[13px] font-medium ${view === k ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>{l}</button>)}
            </div>
            {team.cap("roles.manage") && !src.isOwner && !src.isClient && <Button size="sm" icon={Copy} onClick={() => { setNewName({ from: src.id }); setName(`${src.name} (copy)`); }}>Duplicate</Button>}
            {src.kind === "custom" && editable && <Button size="sm" variant="ghost" disabled={members.length > 0} title={members.length ? "Reassign its members first" : undefined} onClick={() => { if (team.deleteRole(src.id)) { toast("Role deleted"); setSel(team.roles[0].id); } }}>Delete</Button>}
          </div>
          {!editable && <div className="px-5 pb-4 sm:px-6"><LockedNote text={src.isOwner ? "The Owner role always has full access and can't be edited or assigned by administrators or managers." : src.isClient ? "The Client role is fixed: external portal access to the client's own information only." : "Read-only — you can only edit roles below your own level, and only with the roles & permissions capability."} /></div>}
        </Card>

        {view === "preview" && <Card className="p-5 sm:p-6"><RolePreview role={v} /></Card>}

        {view === "compare" && (
          <Card>
            <CardHeader icon={GitCompare} title="Compare roles" action={<select aria-label="Compare with" value={cmp} onChange={(e) => setCmp(e.target.value)} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink">{team.roles.filter((r) => r.id !== src.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>} />
            <CompareRoles a={src} b={team.roles.find((r) => r.id === cmp) ?? team.roles[1]} />
          </Card>
        )}

        {view === "edit" && (
          <>
            <Card>
              <CardHeader icon={ClipboardList} title="Role settings" action={editable && <Button size="sm" variant="primary" disabled={!diff.length || !v.name.trim()} onClick={() => (diff.some((d) => d.high) ? setConfirm(diff.filter((d) => d.high).map((d) => d.text)) : save())}>Save role</Button>} />
              <fieldset disabled={!editable} className="grid gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6">
                <TextField id="rl-name" label="Role name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
                <SelectField id="rl-scope" label="Record access scope" value={v.scope} onChange={(e) => setV({ ...v, scope: e.target.value as Scope })} options={Object.entries(SCOPE_META).map(([k, x]) => [k, x.label] as [string, string])} />
                <div className="sm:col-span-2"><TextArea id="rl-desc" label="Description" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
                <SelectField id="rl-sens" label="Highest sensitivity level" value={v.maxSensitivity} onChange={(e) => setV({ ...v, maxSensitivity: e.target.value as Sensitivity })} options={SENSITIVITY.map((s) => [s, `${SENSITIVITY_META[s].label} — ${SENSITIVITY_META[s].note}`] as [string, string])} />
                <Checkbox label="Not limited by department" hint={isOwnerActor ? "Owner and Administrator only — every other role needs department membership for service modules." : "Only the Owner can change this."} checked={v.allDepartments} disabled={!isOwnerActor} onChange={() => setV({ ...v, allDepartments: !v.allDepartments })} />
              </fieldset>
            </Card>
            <Card>
              <CardHeader icon={ShieldCheck} title="Permission matrix" subtitle="Module × action. Service modules (dept) also require the member to belong to that department." />
              <div className="border-t border-line"><PermissionMatrix role={v} editable={editable} onToggle={toggle} /></div>
            </Card>
            <Card>
              <CardHeader icon={ClipboardList} title="Record types" subtitle="Narrow a module to specific record types (all on = no restriction)" />
              <div className="border-t border-line"><RecordTypeEditor role={v} editable={editable} onChange={(mod, types) => { const rt = { ...v.recordTypes }; if (types) rt[mod as ModuleKey] = types; else delete rt[mod as ModuleKey]; setV({ ...v, recordTypes: rt }); }} /></div>
            </Card>
            <Card>
              <CardHeader icon={ShieldAlert} title="Sensitive information" subtitle="Separate from ordinary view permissions. SSNs are always masked unless a reveal permission is granted." />
              <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2 sm:px-6">
                {SENSITIVE_GROUPS.map((g) => (
                  <fieldset key={g.key} disabled={!editable}>
                    <legend className="mb-2 text-[13px] font-semibold text-ink">{g.label} <span className="font-normal text-muted">· requires {deptLabel(g.dept)} membership unless not department-limited</span></legend>
                    <div className="space-y-1">
                      {g.perms.map((p) => <label key={p.key} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] ${actorHas(p.key) ? "" : "opacity-60"}`}><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={v.sensitive.includes(p.key)} disabled={!actorHas(p.key)} onChange={() => setV({ ...v, sensitive: v.sensitive.includes(p.key) ? v.sensitive.filter((x) => x !== p.key) : [...v.sensitive, p.key] })} />{p.label}{!actorHas(p.key) && <span className="text-[11px] text-muted">(you don&rsquo;t hold this)</span>}</label>)}
                    </div>
                  </fieldset>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader icon={KeyRound} title="Administrative capabilities" />
              <fieldset disabled={!editable} className="grid gap-1 border-t border-line p-5 sm:grid-cols-2 sm:px-6">
                {CAPABILITIES.map((c) => { const ownerOnly = OWNER_ONLY.includes(c.key); return <label key={c.key} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] ${ownerOnly ? "opacity-60" : ""}`}><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={v.caps.includes(c.key)} disabled={ownerOnly} onChange={() => setV({ ...v, caps: v.caps.includes(c.key) ? v.caps.filter((x) => x !== c.key) : [...v.caps, c.key] })} />{c.label}{ownerOnly && <span className="text-[11px] text-muted">(Owner only)</span>}</label>; })}
              </fieldset>
            </Card>
          </>
        )}

        <Card>
          <CardHeader icon={Users} title={`Members with this role (${members.length})`} />
          <ul className="flex flex-wrap gap-2 px-5 pb-5 sm:px-6">
            {members.length === 0 && <li className="text-[13px] text-muted">No one has this role.</li>}
            {members.map((m) => <li key={m.id}><Link href={memberHref(m.id)} className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-[13px] hover:border-accent"><Initials text={m.initials} size={24} />{m.name}<StatusBadge s={m.status} /></Link></li>)}
          </ul>
        </Card>
      </div>
      <ConfirmDialog open={!!confirm} title={`Save ${v.name}?`} changes={confirm ?? []} onConfirm={save} onClose={() => setConfirm(null)} />
      <Modal open={!!newName} onClose={() => setNewName(null)} title={newName?.from && team.roles.find((r) => r.id === newName.from)?.kind ? "New role" : "New role"} description={`Starts as a copy of ${team.roles.find((r) => r.id === newName?.from)?.name ?? "Staff"}. You can't give a role more than you hold.`} footer={<><Button onClick={() => setNewName(null)}>Cancel</Button><Button variant="primary" disabled={!name.trim() || team.roles.some((r) => r.name.toLowerCase() === name.trim().toLowerCase())} onClick={() => { const id = team.duplicateRole(newName!.from, name.trim()); if (id) { setSel(id); setView("edit"); toast(`${name.trim()} created`); } setNewName(null); }}>Create role</Button></>}>
        <TextField id="nr-name" label="Role name" required value={name} onChange={(e) => setName(e.target.value)} />
        {team.roles.some((r) => r.name.toLowerCase() === name.trim().toLowerCase()) && <p className="mt-1 text-[12px] text-danger-ink">A role with this name already exists.</p>}
      </Modal>
    </div>
  );
}

function CompareRoles({ a, b }: { a: Role; b: Role }) {
  const rows = MODULES.map((m) => ({ m, x: a.perms[m.key] ?? [], y: b.perms[m.key] ?? [] }));
  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted"><tr><th className="px-5 py-2 text-left">Area</th><th className="px-3 py-2 text-left">{a.name}</th><th className="px-3 py-2 text-left">{b.name}</th></tr></thead>
        <tbody>
          {rows.map(({ m, x, y }) => {
            const same = x.join() === y.join();
            return <tr key={m.key} className={`border-b border-line ${same ? "" : "bg-warning-soft/30"}`}><td className="px-5 py-2 font-medium text-ink">{m.label}</td><td className="px-3 py-2 text-ink-2">{x.join(", ") || "—"}</td><td className="px-3 py-2 text-ink-2">{y.join(", ") || "—"}</td></tr>;
          })}
          {[["Record scope", SCOPE_META[a.scope].label, SCOPE_META[b.scope].label], ["All departments", a.allDepartments ? "Yes" : "No", b.allDepartments ? "Yes" : "No"], ["Highest sensitivity", a.maxSensitivity, b.maxSensitivity], ["Sensitive information", a.sensitive.map(sensitiveLabel).join("; ") || "None", b.sensitive.map(sensitiveLabel).join("; ") || "None"], ["Administrative", a.caps.join(", ") || "None", b.caps.join(", ") || "None"]].map(([k, x, y]) => <tr key={k} className={`border-b border-line last:border-0 ${x === y ? "" : "bg-warning-soft/30"}`}><td className="px-5 py-2 font-medium text-ink">{k}</td><td className="px-3 py-2 text-ink-2">{x}</td><td className="px-3 py-2 text-ink-2">{y}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================== */

function Departments() {
  const team = useTeam();
  const toast = useToast();
  const editable = team.can("team", "settings");
  return (
    <div className="space-y-5">
      {!editable && <LockedNote text="Read-only — department settings need the Team & Permissions “Manage settings” permission." />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        {team.departments.map((d) => {
          const meta = DEPARTMENTS.find((x) => x.key === d.key)!;
          const members = team.members.filter((m) => m.departments.includes(d.key) && m.status !== "deactivated");
          const candidates = team.members.filter((m) => m.status === "active" && (roleOf(team.roles, m)?.level ?? 0) >= 60);
          return (
            <Card key={d.key}>
              <CardHeader icon={Building2} title={meta.label} subtitle={`${members.length} member(s)`} />
              <fieldset disabled={!editable} className="space-y-4 border-t border-line p-5 sm:px-6">
                <SelectField id={`dp-mgr-${d.key}`} label="Department manager" value={d.managerId ?? ""} onChange={(e) => { team.saveDepartment({ ...d, managerId: e.target.value || undefined }); toast("Department manager updated"); }} options={[["", "No manager"], ...candidates.map((m) => [m.id, `${m.name} (${roleOf(team.roles, m)?.name})`] as [string, string])]} />
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Department access</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(MODULE_DEPT) as ModuleKey[]).map((mod) => { const on = d.modules.includes(mod); return <button key={mod} type="button" aria-pressed={on} onClick={() => { team.saveDepartment({ ...d, modules: on ? d.modules.filter((x) => x !== mod) : [...d.modules, mod] }); toast("Department access updated"); }} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{MODULES.find((x) => x.key === mod)!.label}</button>; })}
                  </div>
                  <p className="mt-1 text-[12px] text-muted">Members get these service modules (subject to their role). Being in this department never grants other departments.</p>
                </div>
                <Checkbox label="Department reporting" hint="Members can view department-level reports (if their role allows Reports)." checked={d.reporting} onChange={() => team.saveDepartment({ ...d, reporting: !d.reporting })} />
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Department workflow permissions</span>
                  <div className="space-y-1.5">
                    {WORKFLOW_PERMS[d.key].map((w) => <div key={w} className="flex flex-wrap items-center gap-2 text-[13px]"><span className="min-w-[180px] flex-1 text-ink">{w}</span><select aria-label={`${meta.label}: ${w}`} value={d.workflow[w] ?? "off"} onChange={(e) => team.saveDepartment({ ...d, workflow: { ...d.workflow, [w]: e.target.value as "manager" } })} className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink">{Object.entries(WORKFLOW_LEVEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>)}
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Members</span>
                  <ul className="flex flex-wrap gap-1.5">{members.map((m) => <li key={m.id}><Link href={memberHref(m.id)} className="inline-flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-0.5 pr-2.5 text-[12.5px] hover:border-accent"><Initials text={m.initials} size={22} />{m.name}{m.id === d.managerId && <Badge tone="info">Manager</Badge>}</Link></li>)}</ul>
                  <p className="mt-1 text-[12px] text-muted">Add or remove members from each person&rsquo;s profile.</p>
                </div>
              </fieldset>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */

function Invitations({ onInvite }: { onInvite: () => void }) {
  const team = useTeam();
  const toast = useToast();
  const can = team.can("team", "create");
  const tone = { pending: "info", accepted: "success", expired: "warning", cancelled: "neutral" } as const;
  return (
    <Card>
      <CardHeader icon={Mail} title="Invitations" subtitle="Invitations expire; resend or cancel any pending or expired invitation" action={can && <Button size="sm" variant="primary" icon={UserPlus} onClick={onInvite}>Invite</Button>} />
      <ul className="divide-y divide-line border-t border-line">
        {team.invitations.map((i) => {
          const expired = i.status === "pending" && i.expiresAt < SAMPLE_NOW.toISOString();
          const st = expired ? "expired" : i.status;
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <div className="min-w-0 flex-1 basis-[50%] sm:basis-auto"><Link href={memberHref(i.memberId)} className="text-[14px] font-semibold text-ink hover:text-accent">{i.name}</Link><div className="text-[12px] text-muted">{i.email} · {team.roles.find((r) => r.id === i.roleId)?.name} · {i.departments.map(deptLabel).join(", ") || "no department"} · sent {relTime(i.sentAt)} by {team.members.find((m) => m.id === i.invitedBy)?.name}{st === "pending" ? ` · expires ${fmtDate(i.expiresAt)}` : ""}</div></div>
              <Badge tone={tone[st]}>{st[0].toUpperCase() + st.slice(1)}</Badge>
              {can && (st === "pending" || st === "expired") && (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" icon={Send} onClick={() => { team.resendInvite(i.id); toast("Invitation resent"); }}>Resend</Button>
                  <Button size="sm" variant="ghost" onClick={() => { team.cancelInvite(i.id); toast("Invitation cancelled"); }}>Cancel</Button>
                  {st === "pending" && <Button size="sm" variant="ghost" title="Sample only — real acceptance happens through sign-up in Phase 3" onClick={() => { team.simulateAccept(i.id); toast("Accepted (simulated)"); }}>Simulate acceptance</Button>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const team = useTeam();
  const toast = useToast();
  const router = useRouter();
  const roles = team.assignableRoles();
  const blank = { name: "", email: "", phone: "", title: "", roleId: roles.find((r) => r.id === "role-staff")?.id ?? roles[0]?.id ?? "", departments: [] as DeptKey[], managerId: "", grants: [] as string[], days: "7" };
  const [v, setV] = useState(blank);
  const [tried, setTried] = useState(false);
  useEffect(() => { if (open) { setV(blank); setTried(false); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const dupe = team.members.some((m) => m.email.toLowerCase() === v.email.trim().toLowerCase() && m.status !== "deactivated");
  const errs = [!v.name.trim() && "Enter the name", validateEmail(v.email, true), dupe && "Someone with this email is already on the team", !v.roleId && "Choose a role", !v.departments.length && "Choose at least one department"].filter(Boolean) as string[];
  const myGrantable = SENSITIVE_GROUPS.flatMap((g) => [...g.perms] as { key: string; label: string }[]).filter((p) => team.sensitive(p.key));
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Invite a team member" description="They receive an email invitation (sent by the backend in Phase 3). Nothing is granted until they accept." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={Send} onClick={() => { setTried(true); if (errs.length) return; const id = team.invite({ name: v.name.trim(), email: v.email.trim().toLowerCase(), phone: v.phone, title: v.title.trim() || "Team member", roleId: v.roleId, departments: v.departments, managerId: v.managerId || undefined, grants: v.grants, expiresInDays: Number(v.days) }); if (id) { toast(`Invitation sent to ${v.email}`); onClose(); router.push(memberHref(id)); } else toast("You can't invite with that role"); }}>Send invitation</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="iv-name" label="Full name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <TextField id="iv-title" label="Job title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          <EmailInput id="iv-email" label="Work email" required value={v.email} onChange={(x) => setV({ ...v, email: x })} showErrors={tried} />
          <PhoneInput id="iv-phone" label="Phone" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} showErrors={tried} />
          <SelectField id="iv-role" label="Role" required value={v.roleId} onChange={(e) => setV({ ...v, roleId: e.target.value })} options={roles.map((r) => [r.id, r.name] as [string, string])} />
          <SelectField id="iv-mgr" label="Manager" value={v.managerId} onChange={(e) => setV({ ...v, managerId: e.target.value })} options={[["", "No manager"], ...team.members.filter((m) => m.status === "active").map((m) => [m.id, m.name] as [string, string])]} />
          <SelectField id="iv-exp" label="Invitation expires" value={v.days} onChange={(e) => setV({ ...v, days: e.target.value })} options={[["3", "In 3 days"], ["7", "In 7 days"], ["14", "In 14 days"]]} />
        </div>
        <p className="text-[12px] text-muted">Only roles below your own are offered. The Owner role can&rsquo;t be assigned by invitation.</p>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Departments <span className="text-danger">*</span></span>
          <div className="flex flex-wrap gap-1.5">{DEPARTMENTS.map((d) => { const on = v.departments.includes(d.key); return <button key={d.key} type="button" aria-pressed={on} onClick={() => setV({ ...v, departments: on ? v.departments.filter((x) => x !== d.key) : [...v.departments, d.key] })} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{d.label}</button>; })}</div>
        </div>
        {myGrantable.length > 0 && (
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-[13px] font-medium text-ink">Initial sensitive permissions (optional)</summary>
            <p className="mt-1 text-[12px] text-muted">Only permissions you hold yourself can be granted.</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">{myGrantable.map((p) => <label key={p.key} className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={v.grants.includes(p.key)} onChange={() => setV({ ...v, grants: v.grants.includes(p.key) ? v.grants.filter((x) => x !== p.key) : [...v.grants, p.key] })} />{sensitiveLabel(p.key)}</label>)}</div>
          </details>
        )}
        {tried && errs.length > 0 && <p className="text-[12.5px] text-danger-ink" role="alert">{errs.join(" · ")}</p>}
      </div>
    </Modal>
  );
}

/* ================================================================== */

function Requests() {
  const team = useTeam();
  const toast = useToast();
  const [note, setNote] = useState<Record<string, string>>({});
  const name = (id?: string) => team.members.find((m) => m.id === id)?.name ?? "—";
  const label = (r: (typeof team.requests)[number]) => (r.kind === "sensitive" ? sensitiveLabel(r.target) : r.kind === "module" ? `${MODULES.find((m) => m.key === r.target)?.label ?? r.target} (module access)` : `Record ${r.target.replace("client:", "client ")}`);
  const pending = team.requests.filter((r) => r.status === "pending");
  const done = team.requests.filter((r) => r.status !== "pending");
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={KeyRound} title="Pending access requests" subtitle="Sensitive-information requests can only be approved by the Owner. No one approves their own request." />
        <ul className="divide-y divide-line border-t border-line">
          {pending.length === 0 && <li className="px-6 py-8 text-center text-[13px] text-muted">No pending requests.</li>}
          {pending.map((r) => {
            const can = team.canDecide(r.id);
            return (
              <li key={r.id} className="space-y-2 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-2"><Link href={memberHref(r.memberId)} className="text-[14px] font-semibold text-ink hover:text-accent">{name(r.memberId)}</Link><span className="text-[13px] text-ink-2">requests</span><Badge tone={r.kind === "sensitive" ? "danger" : "info"}>{label(r)}</Badge><span className="ml-auto text-[12px] text-muted">{relTime(r.requestedAt)}</span></div>
                <p className="text-[13px] text-ink-2">“{r.reason}”</p>
                {can ? (
                  <div className="flex flex-wrap gap-2">
                    <input aria-label="Decision note" value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} placeholder="Note (optional)" className="h-9 min-w-[200px] flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink" />
                    <Button size="sm" onClick={() => { team.decide(r.id, false, note[r.id]); toast("Denied"); }}>Deny</Button>
                    <Button size="sm" variant="primary" icon={BadgeCheck} onClick={() => { team.decide(r.id, true, note[r.id]); toast(r.kind === "module" ? "Approved — add the member to a department with that access" : "Approved"); }}>Approve</Button>
                  </div>
                ) : <LockedNote text={r.memberId === team.me?.id ? "You can't decide your own request." : r.kind === "sensitive" ? "Only the Owner can approve sensitive-information access." : "You don't have permission to approve access requests."} />}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardHeader icon={ClipboardList} title="Decided requests" />
        <ul className="divide-y divide-line border-t border-line">
          {done.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-[13px] sm:px-6"><Badge tone={r.status === "approved" ? "success" : "neutral"}>{r.status === "approved" ? "Approved" : "Denied"}</Badge><span className="font-medium text-ink">{name(r.memberId)}</span><span className="text-ink-2">{label(r)}</span><span className="text-muted">· by {name(r.decidedBy)} {r.decidedAt ? relTime(r.decidedAt) : ""}{r.note ? ` — ${r.note}` : ""}</span></li>)}
        </ul>
      </Card>
    </div>
  );
}

/* ================================================================== */

function Audit() {
  const team = useTeam();
  const toast = useToast();
  const [action, setAction] = useState("all");
  const [who, setWho] = useState("all");
  const [dept, setDept] = useState("all");
  const [result, setResult] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const rows = useMemo(() => team.audit.filter((e) => (action === "all" || e.action === action) && (who === "all" || e.actorId === who) && (dept === "all" || e.department === dept) && (result === "all" || (result === "ok" ? e.success : !e.success)) && (!q.trim() || `${e.resource} ${e.meta ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [team.audit, action, who, dept, result, q]);
  useEffect(() => setPage(0), [action, who, dept, result, q]);
  if (!team.cap("audit.view")) return <LockedNote text="Audit logs are restricted to authorized administrators and the Owner." />;
  const per = 15;
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const sel = "h-9 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink-2";
  const name = (id: string) => team.members.find((m) => m.id === id)?.name ?? "Former team member";
  return (
    <Card>
      <CardHeader icon={Activity} title="Audit log" subtitle={`${rows.length} event(s) · read-only — audit records can't be edited or deleted`} action={<Button size="sm" icon={Download} disabled={!team.can("team", "export")} onClick={() => { team.log({ action: "Record export", resource: "Audit log", meta: `${rows.length} events` }); toast("Audit export recorded (sample — no file in the preview)"); }}>Export</Button>} />
      <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6">
        <input aria-label="Search audit log" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resource or details…" className="h-9 min-w-[180px] flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink" />
        <select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)} className={sel}><option value="all">All actions</option>{AUDIT_ACTIONS.map((a) => <option key={a}>{a}</option>)}</select>
        <select aria-label="User" value={who} onChange={(e) => setWho(e.target.value)} className={sel}><option value="all">All users</option>{team.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className={sel}><option value="all">All departments</option>{DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
        <select aria-label="Result" value={result} onChange={(e) => setResult(e.target.value)} className={sel}><option value="all">Success & failure</option><option value="ok">Success</option><option value="fail">Failure</option></select>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted"><tr><th className="px-5 py-2.5">When</th><th className="px-3 py-2.5">User</th><th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">Record / resource</th><th className="px-3 py-2.5">Department</th><th className="px-3 py-2.5">Details</th><th className="px-3 py-2.5 pr-5">Result</th></tr></thead>
          <tbody>
            {rows.slice(page * per, page * per + per).map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-5 py-2 text-ink-2">{fmtDateTime(e.at)}</td>
                <td className="px-3 py-2 font-medium text-ink">{name(e.actorId)}</td>
                <td className="px-3 py-2 text-ink-2">{e.action}</td>
                <td className="px-3 py-2 text-ink-2">{e.resource}</td>
                <td className="px-3 py-2 text-ink-2">{e.department ? deptLabel(e.department) : "—"}</td>
                <td className="px-3 py-2 text-[12.5px] text-muted">{e.meta ?? ""}</td>
                <td className="px-3 py-2 pr-5">{e.success ? <Badge tone="success">Success</Badge> : <Badge tone="danger">Failure</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3 sm:px-6">
        <Button size="sm" icon={ChevronLeft} aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)} />
        <span className="text-[12.5px] text-muted">Page {page + 1} of {pages}</span>
        <Button size="sm" icon={ChevronRight} aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} />
      </div>
    </Card>
  );
}

/* ================================================================== */

function Security() {
  const team = useTeam();
  const toast = useToast();
  const [v, setV] = useState(team.security);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setV(team.security), [team.security]);
  const editable = team.cap("security.manage");
  const dirty = JSON.stringify(v) !== JSON.stringify(team.security);
  const notEnrolled = team.members.filter((m) => m.status === "active" && m.mfa === "not_enrolled");
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning-soft/50 px-4 py-3 text-[13px] text-warning-ink">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>Policy configuration only. These settings are saved for the authentication service that arrives in Phase 3, which will enforce them on the server. The prototype doesn&rsquo;t pretend to enforce them.</span>
      </div>
      {!editable && <LockedNote text="Read-only — only the Owner manages security settings." />}
      <Card>
        <CardHeader icon={Lock} title="Security policy" subtitle={team.security.updatedAt ? `Last changed ${fmtDateTime(team.security.updatedAt)} by ${team.members.find((m) => m.id === team.security.updatedBy)?.name}` : "Defaults"} action={editable && <Button size="sm" variant="primary" disabled={!dirty} onClick={() => setConfirm(true)}>Save policy</Button>} />
        <fieldset disabled={!editable} className="grid gap-4 border-t border-line p-5 sm:grid-cols-2 sm:px-6">
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Multi-factor authentication required for</span>
            <div className="flex flex-wrap gap-1.5">{team.roles.filter((r) => !r.isClient).map((r) => { const on = v.mfaRequiredFor.includes(r.id); return <button key={r.id} type="button" aria-pressed={on} disabled={!editable || (r.isOwner && on)} onClick={() => setV({ ...v, mfaRequiredFor: on ? v.mfaRequiredFor.filter((x) => x !== r.id) : [...v.mfaRequiredFor, r.id] })} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{r.name}</button>; })}</div>
            <p className="mt-1 text-[12px] text-muted">MFA can&rsquo;t be turned off for the Owner.</p>
          </div>
          <TextField id="sc-len" label="Minimum password length" type="number" min={8} max={64} value={v.passwordMinLength} onChange={(e) => setV({ ...v, passwordMinLength: Math.max(8, Number(e.target.value)) })} />
          <SelectField id="sc-rot" label="Password rotation" value={String(v.passwordRotationDays)} onChange={(e) => setV({ ...v, passwordRotationDays: Number(e.target.value) })} options={[["0", "Not required (recommended with MFA)"], ["90", "Every 90 days"], ["180", "Every 180 days"]]} />
          <Checkbox label="Require mixed character types" checked={v.passwordComplexity} onChange={() => setV({ ...v, passwordComplexity: !v.passwordComplexity })} />
          <Checkbox label="Re-authenticate before revealing or exporting sensitive information" checked={v.reauthForSensitive} onChange={() => setV({ ...v, reauthForSensitive: !v.reauthForSensitive })} />
          <SelectField id="sc-sess" label="Session expires after inactivity" value={String(v.sessionTimeoutMinutes)} onChange={(e) => setV({ ...v, sessionTimeoutMinutes: Number(e.target.value) })} options={[["15", "15 minutes"], ["30", "30 minutes"], ["60", "1 hour"], ["240", "4 hours"]]} />
          <SelectField id="sc-fail" label="Lock account after failed attempts" value={String(v.maxFailedAttempts)} onChange={(e) => setV({ ...v, maxFailedAttempts: Number(e.target.value) })} options={[["3", "3 attempts"], ["5", "5 attempts"], ["10", "10 attempts"]]} />
          <SelectField id="sc-lock" label="Lockout duration" value={String(v.lockoutMinutes)} onChange={(e) => setV({ ...v, lockoutMinutes: Number(e.target.value) })} options={[["15", "15 minutes"], ["60", "1 hour"], ["0", "Until an administrator unlocks"]]} />
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Account recovery</span>
            <div className="flex flex-wrap gap-1.5">{["Email verification", "Owner-approved reset", "Backup codes"].map((x) => { const on = v.recovery.includes(x); return <button key={x} type="button" aria-pressed={on} onClick={() => setV({ ...v, recovery: on ? v.recovery.filter((y) => y !== x) : [...v.recovery, x] })} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}>{x}</button>; })}</div>
          </div>
        </fieldset>
      </Card>
      <Card>
        <CardHeader icon={KeyRound} title="Multi-factor enrollment" subtitle={`${notEnrolled.length} active member(s) not enrolled`} />
        <ul className="divide-y divide-line border-t border-line">
          {notEnrolled.length === 0 && <li className="px-6 py-6 text-center text-[13px] text-muted">Everyone is enrolled.</li>}
          {notEnrolled.map((m) => <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-[13px] sm:px-6"><Initials text={m.initials} size={28} /><Link href={memberHref(m.id)} className="flex-1 font-medium text-ink hover:text-accent">{m.name}</Link><span className="text-muted">{roleOf(team.roles, m)?.name}</span>{v.mfaRequiredFor.includes(m.roleId) && <Badge tone="warning">Required for this role</Badge>}</li>)}
        </ul>
      </Card>
      <Card>
        <CardHeader icon={RotateCcw} title="Ownership & account recovery" subtitle="Owner only" />
        <div className="space-y-2 px-5 pb-5 sm:px-6">
          <p className="text-[13px] text-ink-2">Ownership transfer requires identity verification and confirmation by the current Owner. It&rsquo;s built with the authentication service in Phase 3, so it isn&rsquo;t available in the preview.</p>
          <Button disabled icon={X} title="Available in Phase 3">Transfer ownership</Button>
        </div>
      </Card>
      <ConfirmDialog open={confirm} title="Save security policy?" changes={["Applies to every team member at their next sign-in once the authentication service is connected."]} onConfirm={() => { if (team.saveSecurity(v)) toast("Security policy saved"); }} onClose={() => setConfirm(false)} />
    </div>
  );
}

export { Users as TeamIcon, ShieldAlert };
