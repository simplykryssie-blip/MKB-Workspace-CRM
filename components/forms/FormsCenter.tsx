"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClipboardList, ExternalLink, FilePlus2, FileText, Inbox, Search, Send, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Kpi } from "@/components/biz/BizBits";
import { useForms } from "@/lib/store/forms-store";
import { useLeads } from "@/lib/store/leads-store";
import { useClients } from "@/lib/store/clients-store";
import { useTeam } from "@/lib/store/team-store";
import { OUTCOME_META, publicPath, type LeadForm, type Submission } from "@/lib/forms/config";
import { SAMPLE_NOW } from "@/lib/sample/clients";
import { fmtDateTime, relTime } from "@/lib/format";

export const formHref = (id: string, tab?: string) => `/forms/${id}${tab ? `#${tab}` : ""}`;
const STATUS_TONE = { published: "success", draft: "neutral", archived: "warning" } as const;

export function FormsCenter() {
  const forms = useForms();
  const leads = useLeads();
  const team = useTeam();
  const [tab, setTab] = useState<"forms" | "submissions">("forms");
  const [creating, setCreating] = useState(false);
  const recent = forms.submissions.filter((s) => SAMPLE_NOW.getTime() - new Date(s.at).getTime() < 30 * 86400000);
  const leadIds = new Set(forms.submissions.filter((s) => s.leadId && s.outcome !== "spam").map((s) => s.leadId!));
  const converted = leads.leads.filter((l) => leadIds.has(l.id) && l.status === "converted").length;
  const canEdit = team.can("leads", "edit");
  return (
    <>
      <PageHeader
        title="Forms"
        subtitle="Lead-capture forms for your website and social links. Every submission lands in Leads automatically — no copying, no duplicates."
        actions={canEdit && <Button variant="primary" icon={FilePlus2} onClick={() => setCreating(true)}>New form</Button>}
      />
      <div className="mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Published forms" value={forms.forms.filter((f) => f.status === "published").length} sub={`${forms.forms.filter((f) => f.status === "draft").length} draft`} icon={FileText} />
        <Kpi label="Submissions (30 days)" value={recent.filter((s) => s.outcome !== "spam").length} sub={`${recent.filter((s) => s.outcome === "spam").length} spam blocked`} icon={Inbox} onClick={() => setTab("submissions")} />
        <Kpi label="New leads from forms" value={forms.submissions.filter((s) => s.outcome === "new_lead").length} icon={UserPlus} tone="success" />
        <Kpi label="Became clients" value={converted} sub={leadIds.size ? `${Math.round((converted / leadIds.size) * 100)}% of form leads` : undefined} icon={Users} />
      </div>
      <div role="tablist" aria-label="Forms" className="mb-4 flex gap-1 border-b border-line">
        {([["forms", `Forms (${forms.forms.length})`], ["submissions", `Submissions (${forms.submissions.length})`]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2.5 text-[13.5px] font-medium ${tab === k ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>)}
      </div>
      {tab === "forms" ? <FormsList /> : <SubmissionsTable />}
      <NewFormDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function FormsList() {
  const forms = useForms();
  const count = (f: LeadForm) => forms.submissions.filter((s) => s.formId === f.id && s.outcome !== "spam").length;
  const last = (f: LeadForm) => forms.submissions.filter((s) => s.formId === f.id).sort((a, b) => b.at.localeCompare(a.at))[0];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {forms.forms.map((f) => (
        <Card key={f.id} className="flex flex-col p-5">
          <div className="flex items-start gap-2">
            <Link href={formHref(f.id)} className="min-w-0 flex-1 text-[16px] font-semibold text-ink hover:text-accent">{f.name}</Link>
            <Badge tone={STATUS_TONE[f.status]}>{f.status[0].toUpperCase() + f.status.slice(1)}</Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] text-muted">{f.intro || f.title}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
            <div><dt className="text-muted">Fields</dt><dd className="text-[15px] font-semibold text-ink">{f.fields.filter((x) => x.type !== "heading" && x.type !== "paragraph").length}</dd></div>
            <div><dt className="text-muted">Submissions</dt><dd className="text-[15px] font-semibold text-ink">{count(f)}</dd></div>
            <div><dt className="text-muted">Last</dt><dd className="text-[13px] font-medium text-ink">{last(f) ? relTime(last(f).at) : "—"}</dd></div>
          </dl>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <Button size="sm" href={formHref(f.id)}>Edit</Button>
            <Button size="sm" variant="ghost" href={formHref(f.id, "test")}>Test</Button>
            {f.status === "published" && <Button size="sm" variant="ghost" icon={ExternalLink} href={formHref(f.id, "share")}>Share</Button>}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function SubmissionsTable({ formId }: { formId?: string }) {
  const forms = useForms();
  const leads = useLeads();
  const { clients } = useClients();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [open, setOpen] = useState<Submission | null>(null);
  const rows = useMemo(() => forms.submissions
    .filter((s) => (!formId || s.formId === formId) && (outcome === "all" || s.outcome === outcome))
    .filter((s) => !q.trim() || Object.values(s.data).join(" ").toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.at.localeCompare(a.at)), [forms.submissions, formId, outcome, q]);
  const form = (s: Submission) => forms.forms.find((f) => f.id === s.formId);
  const who = (s: Submission) => { const f = form(s); const name = f?.fields.find((x) => x.map === "fullName" || x.map === "firstName"); const email = f?.fields.find((x) => x.map === "email"); return { name: (name && s.data[name.id]) || "—", email: (email && s.data[email.id]) || "" }; };
  return (
    <Card>
      <div className="flex flex-wrap gap-2 p-4 sm:px-5">
        <div className="relative min-w-[200px] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input aria-label="Search submissions" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, answers…" className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[14px] text-ink" /></div>
        <select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-2.5 text-[13.5px] text-ink-2"><option value="all">All outcomes</option>{Object.entries(OUTCOME_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</select>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[820px] text-left text-[13.5px]">
          <thead className="bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted"><tr><th className="px-5 py-2.5">Received</th><th className="px-3 py-2.5">Name</th>{!formId && <th className="px-3 py-2.5">Form</th>}<th className="px-3 py-2.5">Channel</th><th className="px-3 py-2.5">Result</th><th className="px-3 py-2.5 pr-5">In CRM</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-muted">No submissions yet.</td></tr>}
            {rows.map((s) => {
              const w = who(s);
              const lead = leads.leads.find((l) => l.id === s.leadId);
              const client = clients.find((c) => c.id === s.clientId);
              return (
                <tr key={s.id} onClick={() => setOpen(s)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-hover">
                  <td className="whitespace-nowrap px-5 py-2.5 text-ink-2">{fmtDateTime(s.at)}</td>
                  <td className="px-3 py-2.5"><div className="font-semibold text-ink">{w.name}</div><div className="text-[12px] text-muted">{w.email}</div></td>
                  {!formId && <td className="px-3 py-2.5 text-ink-2">{form(s)?.name}</td>}
                  <td className="px-3 py-2.5 text-ink-2">{s.channel}</td>
                  <td className="px-3 py-2.5"><Badge tone={OUTCOME_META[s.outcome].tone}>{OUTCOME_META[s.outcome].label}</Badge></td>
                  <td className="px-3 py-2.5 pr-5" onClick={(e) => e.stopPropagation()}>{s.outcome !== "spam" && lead ? <Link href={`/leads/${lead.id}`} className="font-medium text-accent hover:underline">{lead.name}</Link> : s.outcome !== "spam" && client ? <Link href={`/clients/${client.id}`} className="font-medium text-accent hover:underline">{client.name}</Link> : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title="Submission" description={open ? `${form(open)?.name} · ${fmtDateTime(open.at)} · ${open.channel}` : ""} footer={open && <><Button onClick={() => { forms.markSpam(open.id, open.outcome !== "spam"); toast(open.outcome === "spam" ? "Restored" : "Marked as spam"); setOpen(null); }}>{open.outcome === "spam" ? "Not spam" : "Mark as spam"}</Button>{open.leadId && open.outcome !== "spam" && <Button variant="primary" href={`/leads/${open.leadId}`}>Open lead</Button>}{open.clientId && open.outcome !== "spam" && <Button variant="primary" href={`/clients/${open.clientId}`}>Open client</Button>}</>}>
        {open && <dl className="divide-y divide-line rounded-xl border border-line">{(form(open)?.fields ?? []).filter((f) => open.data[f.id] !== undefined && f.type !== "heading" && f.type !== "paragraph").map((f) => <div key={f.id} className="flex flex-wrap gap-x-3 px-3 py-2 text-[13px]"><dt className="min-w-[160px] flex-1 text-muted">{f.type === "consent" ? "Consent to contact" : f.label}</dt><dd className="font-medium text-ink">{(open.data[f.id] || "—").split("|").join(", ")}</dd></div>)}</dl>}
        {open?.outcome === "existing_client" && <p className="mt-3 text-[12.5px] text-muted">Matched an existing client by email or phone, so no lead was created — the submission was added to their activity.</p>}
        {open?.outcome === "existing_lead" && <p className="mt-3 text-[12.5px] text-muted">Matched an open lead by email or phone, so the answers were added to that lead instead of creating a duplicate.</p>}
      </Modal>
    </Card>
  );
}

function NewFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const forms = useForms();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="New form" description="Start blank or copy an existing form. It stays a draft until you publish it." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={Send} disabled={!name.trim()} onClick={() => { const id = forms.createForm(name.trim(), from || undefined); toast("Form created"); onClose(); setName(""); router.push(formHref(id)); }}>Create form</Button></>}>
      <div className="space-y-4">
        <TextField id="nf-name" label="Form name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bookkeeping quote" />
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Start from</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {[["", "Blank (name, email, phone, consent)"], ...forms.forms.filter((f) => f.status !== "archived").map((f) => [f.id, f.name])].map(([id, label]) => <button key={id} type="button" aria-pressed={from === id} onClick={() => setFrom(id)} className={`rounded-xl border px-3 py-2.5 text-left text-[13px] ${from === id ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2"}`}><ClipboardList size={14} className="mr-1.5 inline" />{label}</button>)}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export { publicPath };
