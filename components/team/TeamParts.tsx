"use client";

import { AlertTriangle, Check, Lock, Minus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ACTIONS, CAPABILITIES, MODULES, MODULE_DEPT, RECORD_TYPES, SCOPE_META, SENSITIVE_GROUPS, SENSITIVITY_META, STATUS_META, deptLabel, type MemberStatus, type Role } from "@/lib/team/config";

export const memberHref = (id: string) => `/team/members/${id}`;
export const StatusBadge = ({ s }: { s: MemberStatus }) => <Badge tone={STATUS_META[s].tone}>{STATUS_META[s].label}</Badge>;
export const Initials = ({ text, size = 34 }: { text: string; size?: number }) => (
  <span className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1592ef] to-[#11a36a] font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">{text}</span>
);

/** Plain-language summary of everything a role can reach. */
export function RolePreview({ role, compact = false }: { role: Role; compact?: boolean }) {
  if (role.isClient)
    return <p className="text-[13.5px] text-ink-2">External client portal only: the client&rsquo;s own profile, authorized businesses, documents, service requests, invoices and messages. Never internal notes, staff assignments, other clients or internal workflows.</p>;
  const mods = MODULES.filter((m) => (role.perms[m.key] ?? []).length);
  return (
    <div className="space-y-3 text-[13px]">
      <p className="text-ink-2"><strong className="text-ink">Records:</strong> {SCOPE_META[role.scope].label}{role.allDepartments ? " — every department" : " — only in the member's own departments (service modules need department membership)"}. Highest sensitivity: {SENSITIVITY_META[role.maxSensitivity].label}.</p>
      <div>
        <strong className="text-ink">Modules ({mods.length} of {MODULES.length})</strong>
        <ul className={`mt-1 grid gap-1 ${compact ? "" : "sm:grid-cols-2"}`}>
          {mods.map((m) => (
            <li key={m.key} className="rounded-lg bg-surface-2 px-2.5 py-1.5 ring-1 ring-line">
              <span className="font-medium text-ink">{m.label}</span>{MODULE_DEPT[m.key] && !role.allDepartments && <span className="text-[11.5px] text-muted"> · {deptLabel(MODULE_DEPT[m.key]!)} members only</span>}
              <div className="text-[12px] text-muted">{(role.perms[m.key] ?? []).map((a) => ACTIONS.find((x) => x.key === a)!.label).join(", ")}{role.recordTypes[m.key]?.length ? ` · only: ${role.recordTypes[m.key]!.join(", ")}` : ""}</div>
            </li>
          ))}
        </ul>
        {mods.length < MODULES.length && <p className="mt-1 text-[12px] text-muted">Hidden from navigation: {MODULES.filter((m) => !(role.perms[m.key] ?? []).length).map((m) => m.label).join(", ")}.</p>}
      </div>
      <div>
        <strong className="text-ink">Sensitive information</strong>
        {role.sensitive.length === 0 ? <p className="text-muted">None — masked or hidden.</p> : (
          <ul className="mt-1 space-y-0.5">{SENSITIVE_GROUPS.map((g) => { const on = g.perms.filter((p) => role.sensitive.includes(p.key)); return on.length ? <li key={g.key} className="text-ink-2"><span className="font-medium">{g.label}:</span> {on.map((p) => p.label).join(", ")}</li> : null; })}</ul>
        )}
      </div>
      {role.caps.length > 0 && <p className="text-ink-2"><strong className="text-ink">Administrative:</strong> {role.caps.map((c) => CAPABILITIES.find((x) => x.key === c)!.label).join(", ")}</p>}
    </div>
  );
}

/** Module × action grid. */
export function PermissionMatrix({ role, editable, onToggle }: { role: Role; editable: boolean; onToggle?: (m: string, a: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-[12.5px]">
        <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <tr><th className="px-4 py-2 text-left">Module</th>{ACTIONS.map((a) => <th key={a.key} className="px-1.5 py-2 text-center">{a.label}</th>)}</tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m.key} className="border-b border-line last:border-0">
              <td className="whitespace-nowrap px-4 py-1.5 font-medium text-ink">{m.label}{MODULE_DEPT[m.key] && <span className="ml-1 text-[11px] text-faint">(dept)</span>}</td>
              {ACTIONS.map((a) => {
                const on = (role.perms[m.key] ?? []).includes(a.key);
                return (
                  <td key={a.key} className="px-1.5 py-1.5 text-center">
                    {editable ? (
                      <input type="checkbox" aria-label={`${m.label}: ${a.label}`} checked={on} onChange={() => onToggle?.(m.key, a.key)} className="h-4 w-4 accent-[var(--accent)]" />
                    ) : on ? <Check size={14} className="mx-auto text-success" aria-label={`${m.label}: ${a.label} allowed`} /> : <Minus size={14} className="mx-auto text-faint" aria-label={`${m.label}: ${a.label} not allowed`} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecordTypeEditor({ role, editable, onChange }: { role: Role; editable: boolean; onChange: (module: string, types: string[] | undefined) => void }) {
  return (
    <ul className="divide-y divide-line">
      {MODULES.filter((m) => (role.perms[m.key] ?? []).length).map((m) => {
        const all = RECORD_TYPES[m.key];
        const sel = role.recordTypes[m.key];
        return (
          <li key={m.key} className="flex flex-wrap items-center gap-1.5 px-5 py-2.5 sm:px-6">
            <span className="w-40 shrink-0 text-[13px] font-medium text-ink">{m.label}</span>
            {all.map((t) => {
              const on = !sel || sel.includes(t);
              return <button key={t} type="button" disabled={!editable} aria-pressed={on} onClick={() => { const cur = sel ?? all; const next = on ? cur.filter((x) => x !== t) : [...cur, t]; onChange(m.key, next.length === all.length ? undefined : next); }} className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium disabled:cursor-default ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-faint line-through"}`}>{t}</button>;
            })}
            {sel && <span className="text-[11.5px] text-warning-ink">restricted</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Confirmation for high-impact permission changes — lists exactly what changes. */
export function ConfirmDialog({ open, title, changes, onConfirm, onClose, confirmLabel = "Confirm change" }: { open: boolean; title: string; changes: string[]; onConfirm: () => void; onClose: () => void; confirmLabel?: string }) {
  return (
    <Modal open={open} onClose={onClose} title={title} description="High-impact permission change — please review" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={AlertTriangle} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button></>}>
      <ul className="space-y-1.5">{changes.map((c, i) => <li key={i} className="flex items-start gap-2 rounded-lg bg-warning-soft/60 px-3 py-2 text-[13px] text-ink"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning-ink" /> {c}</li>)}</ul>
      <p className="mt-3 text-[12px] text-muted">This is recorded in the audit log. In production the change takes effect on the server immediately.</p>
    </Modal>
  );
}

/** Lists what changed between two versions of a role, flagging high-impact items. */
export function roleDiff(a: Role, b: Role) {
  const out: { text: string; high: boolean }[] = [];
  MODULES.forEach((m) => {
    const x = a.perms[m.key] ?? [];
    const y = b.perms[m.key] ?? [];
    const add = y.filter((k) => !x.includes(k));
    const rem = x.filter((k) => !y.includes(k));
    if (add.length) out.push({ text: `${m.label}: add ${add.join(", ")}`, high: ["team", "settings", "billing"].includes(m.key) || add.some((k) => ["delete", "export", "settings"].includes(k)) });
    if (rem.length) out.push({ text: `${m.label}: remove ${rem.join(", ")}`, high: false });
  });
  const sAdd = b.sensitive.filter((k) => !a.sensitive.includes(k));
  const sRem = a.sensitive.filter((k) => !b.sensitive.includes(k));
  if (sAdd.length) out.push({ text: `Sensitive access added: ${sAdd.join(", ")}`, high: true });
  if (sRem.length) out.push({ text: `Sensitive access removed: ${sRem.join(", ")}`, high: false });
  const cAdd = b.caps.filter((k) => !a.caps.includes(k));
  if (cAdd.length) out.push({ text: `Administrative capabilities added: ${cAdd.join(", ")}`, high: true });
  if (a.scope !== b.scope) out.push({ text: `Record scope: ${SCOPE_META[a.scope].label} → ${SCOPE_META[b.scope].label}`, high: b.scope === "all_departments" });
  if (a.allDepartments !== b.allDepartments) out.push({ text: `All departments: ${a.allDepartments ? "on" : "off"} → ${b.allDepartments ? "on" : "off"}`, high: b.allDepartments });
  if (a.maxSensitivity !== b.maxSensitivity) out.push({ text: `Highest sensitivity: ${a.maxSensitivity} → ${b.maxSensitivity}`, high: b.maxSensitivity === "restricted" });
  if (JSON.stringify(a.recordTypes) !== JSON.stringify(b.recordTypes)) out.push({ text: "Record-type restrictions changed", high: false });
  if (a.name !== b.name) out.push({ text: `Renamed: ${a.name} → ${b.name}`, high: false });
  if (a.description !== b.description) out.push({ text: "Description updated", high: false });
  return out;
}

export function LockedNote({ text }: { text: string }) {
  return <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-muted ring-1 ring-line"><Lock size={13} className="shrink-0" /> {text}</p>;
}
