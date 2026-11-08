"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/lib/store/clients-store";
import { useBooks } from "@/lib/store/books-store";
import { useTeam } from "@/lib/store/team-store";
import { meId } from "@/lib/sample/clients";
import { REPORT_TYPES, periodLabel, type ReportType } from "@/lib/books/config";

/** MKB's bookkeeping packages (from the website). Fees can be adjusted per client. */
export const BOOKS_PLANS = [
  { key: "Foundation", fee: 399, detail: "Up to 150 transactions • 3 financial accounts" },
  { key: "Essential", fee: 549, detail: "Up to 400 transactions • 5 financial accounts" },
  { key: "Growth", fee: 749, detail: "Up to 750 transactions • 8 financial accounts" },
  { key: "Advanced", fee: 999, detail: "Up to 1,500 transactions • 12 financial accounts" },
] as const;
const INCLUDES = ["Monthly bookkeeping review", "Account reconciliations", "P&L, Balance Sheet and Cash Flow", "Month-end close", "Financial record organization", "Standard bookkeeping support"];
const DEFAULT_REPORTS: ReportType[] = ["Profit and Loss", "Balance Sheet", "Cash Flow Statement"];
type Acct = { name: string; kind: "bank" | "credit_card"; mask: string; institution: string };

const monthOptions = (): [string, string][] => {
  const d = new Date();
  const out: [string, string][] = [];
  for (let i = -3; i <= 2; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() + i, 15);
    const p = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
    out.push([p, periodLabel(p)]);
  }
  return out;
};

export function StartWorkspace({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const clients = useClients();
  const books = useBooks();
  const team = useTeam();
  const toast = useToast();
  const staff = useMemo(() => team.members.filter((m) => m.status === "active"), [team.members]);
  const months = useMemo(monthOptions, []);
  const [clientId, setClientId] = useState("");
  const client = clients.clients.find((c) => c.id === clientId);
  const [businessName, setBusinessName] = useState("");
  const [entityType, setEntityType] = useState("LLC");
  const [plan, setPlan] = useState<string>("Foundation");
  const [fee, setFee] = useState(399);
  const [reports, setReports] = useState<ReportType[]>(DEFAULT_REPORTS);
  const [bookkeeperId, setBookkeeperId] = useState(meId());
  const [reviewerId, setReviewerId] = useState(meId());
  const [period, setPeriod] = useState(months[2][0]);
  const [qbo, setQbo] = useState("");
  const [accounts, setAccounts] = useState<Acct[]>([{ name: "Business checking", kind: "bank", mask: "", institution: "" }]);
  const [err, setErr] = useState<string | null>(null);

  const pickClient = (id: string) => {
    setClientId(id);
    const c = clients.clients.find((x) => x.id === id);
    if (c) setBusinessName(c.business?.legalName ?? c.name);
  };
  const submit = () => {
    if (!client) return setErr("Choose the client.");
    if (!businessName.trim()) return setErr("Enter the business name.");
    if (accounts.some((a) => !a.name.trim())) return setErr("Give every account a name (or remove it).");
    if (accounts.some((a) => a.mask && !/^\d{4}$/.test(a.mask))) return setErr("Account numbers: enter only the last 4 digits.");
    const enrollmentId = client.enrollments?.find((e) => e.service === "books")?.id;
    const id = books.createWorkspace({ clientId: client.id, enrollmentId, businessName, entityType, plan, monthlyFee: fee, reports, includes: INCLUDES, bookkeeperId, reviewerId, accounts, firstPeriod: period, qboCompany: qbo });
    toast(`Bookkeeping started for ${businessName.trim()}`);
    onCreated(id);
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Start bookkeeping" description="Sets up monthly review, reconciliation and close for one client business. The client keeps their own QuickBooks." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Start bookkeeping</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Client" required value={clientId} onChange={(e) => pickClient(e.target.value)} options={[["", clients.clients.length ? "Choose a client…" : "Add the client in Clients first"], ...clients.clients.map((c): [string, string] => [c.id, c.name])]} />
          <TextField label="Business name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <SelectField label="Business type" value={entityType} onChange={(e) => setEntityType(e.target.value)} options={["LLC", "S Corporation", "C Corporation", "Sole proprietorship", "Partnership", "Nonprofit"].map((x): [string, string] => [x, x])} />
          <TextField label="QuickBooks company name" hint="optional" value={qbo} onChange={(e) => setQbo(e.target.value)} />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Plan</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOOKS_PLANS.map((p) => (
              <button key={p.key} type="button" onClick={() => { setPlan(p.key); setFee(p.fee); }} className={`rounded-xl border p-3 text-left ${plan === p.key ? "border-accent bg-accent-soft/50" : "border-line hover:bg-surface-hover"}`}>
                <span className="block text-[14px] font-semibold text-ink">{p.key} · ${p.fee}{p.key === "Advanced" ? "+" : ""}/mo</span>
                <span className="block text-[12.5px] text-muted">{p.detail}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-[220px]"><TextField label="Monthly fee ($)" type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value))} /></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Bookkeeper" value={bookkeeperId} onChange={(e) => setBookkeeperId(e.target.value)} options={staff.map((m): [string, string] => [m.id, m.name])} />
          <SelectField label="Reviewer" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} options={staff.map((m): [string, string] => [m.id, m.name])} />
          <SelectField label="First month" value={period} onChange={(e) => setPeriod(e.target.value)} options={months} />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Reports each month</span>
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.map((r) => (
              <label key={r} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13px] ${reports.includes(r) ? "border-accent bg-accent-soft/40 text-ink" : "border-line text-ink-2"}`}>
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={reports.includes(r)} onChange={(e) => setReports(e.target.checked ? [...reports, r] : reports.filter((x) => x !== r))} />{r}
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Bank and credit card accounts to reconcile</span>
          <p className="mb-2 text-[12.5px] text-muted">Only the last 4 digits are kept — never enter full account numbers.</p>
          <div className="space-y-2">
            {accounts.map((a, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-line bg-bg p-3 sm:grid-cols-[1.4fr_1fr_1fr_90px_auto] sm:items-end">
                <TextField label="Account name" value={a.name} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <TextField label="Bank" value={a.institution} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, institution: e.target.value } : x)))} />
                <SelectField label="Type" value={a.kind} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, kind: e.target.value as Acct["kind"] } : x)))} options={[["bank", "Bank"], ["credit_card", "Credit card"]]} />
                <TextField label="Last 4" inputMode="numeric" maxLength={4} value={a.mask} onChange={(e) => setAccounts(accounts.map((x, j) => (j === i ? { ...x, mask: e.target.value.replace(/\D/g, "").slice(0, 4) } : x)))} />
                <button type="button" aria-label="Remove account" onClick={() => setAccounts(accounts.filter((_, j) => j !== i))} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-surface-hover"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <Button size="sm" className="mt-2" icon={Plus} onClick={() => setAccounts([...accounts, { name: "", kind: "bank", mask: "", institution: "" }])}>Add account</Button>
        </div>
        {err && <p role="alert" className="rounded-xl bg-danger-soft/60 px-3 py-2 text-[13px] text-danger-ink">{err}</p>}
      </div>
    </Modal>
  );
}
