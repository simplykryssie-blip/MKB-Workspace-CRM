"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox, TextArea, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { newId, useMonarch } from "@/lib/store/monarch-store";
import { pct, usd, type MonarchData, type Reseller } from "@/lib/monarch/types";
import { Empty, MonarchGate, shortDate, TABLE_HEAD, useAct } from "./MonarchBits";

export function ResellersPage() {
  return <MonarchGate>{(d) => <Resellers d={d} />}</MonarchGate>;
}

function Resellers({ d }: { d: MonarchData }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [sel, setSel] = useState<string>(d.resellers[0]?.id ?? "");
  const [edit, setEdit] = useState<Reseller | "new" | null>(null);
  useEffect(() => { if (!d.resellers.some((r) => r.id === sel) && d.resellers[0]) setSel(d.resellers[0].id); }, [d.resellers, sel]);
  const owed = (id: string) => d.commissions.filter((c) => c.resellerId === id && c.status === "owed").reduce((n, c) => n + c.amountCents, 0);
  const r = d.resellers.find((x) => x.id === sel);
  const coms = d.commissions.filter((c) => c.resellerId === sel);
  const pending = d.sales.filter((s) => s.resellerId === sel && s.status === "unpaid");
  const totalOwed = r ? owed(r.id) : 0;
  return (
    <div>
      <PageHeader title="Resellers & Commissions" subtitle="People who bring you offices, and what you owe them." actions={<Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>Add reseller</Button>} />
      {d.resellers.length ? (
        <section aria-label="Resellers" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.resellers.map((x) => (
            <button key={x.id} type="button" onClick={() => setSel(x.id)} aria-pressed={sel === x.id} className={`rounded-2xl border bg-surface p-4 text-left shadow-soft ${sel === x.id ? "border-accent ring-1 ring-accent" : "border-line hover:border-line-strong"} ${x.active ? "" : "opacity-60"}`}>
              <span className="flex items-center justify-between gap-2"><span className="text-[15px] font-bold text-ink">{x.name}</span>{!x.active && <Badge>Inactive</Badge>}</span>
              <span className="block text-[12.5px] text-muted">{[x.contact, x.phone].filter(Boolean).join(" · ") || "—"}</span>
              <span className="mt-3 grid grid-cols-3 gap-2 text-[12px] text-muted">
                <span>Rate<b className="block text-[18px] text-ink">{pct(x.rateBp)}</b></span>
                <span>Offices<b className="block text-[18px] text-ink">{d.offices.filter((o) => o.resellerId === x.id).length}</b></span>
                <span>Owed<b className={`block text-[18px] ${owed(x.id) ? "text-success-ink" : "text-ink"}`}>{usd(owed(x.id))}</b></span>
              </span>
            </button>
          ))}
        </section>
      ) : <Card className="mb-4"><Empty title="No resellers yet">Add a reseller, then choose them on an office. They earn their rate on that office&rsquo;s paid sales.</Empty></Card>}

      {r && (
        <Card>
          <CardHeader title={`${r.name} — commissions`} subtitle={`Created when an office they brought in pays. ${pct(r.rateBp)} of the sale. Refunds cancel the commission.`}
            action={<div className="flex flex-wrap gap-2"><Button size="sm" icon={Pencil} onClick={() => setEdit(r)}>Edit</Button>{totalOwed > 0 && <Button size="sm" variant="primary" icon={Check} disabled={!!busy} onClick={() => confirm(`Mark ${usd(totalOwed)} paid to ${r.name}? Pay them first — this only records it.`) && void run("pay", () => m.apply("POST", "/api/monarch/commissions", { resellerId: r.id }), "Commissions marked paid")}>Mark {usd(totalOwed)} paid</Button>}</div>} />
          {coms.length || pending.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-[13.5px]">
                <thead className={TABLE_HEAD}><tr><th className="px-5 py-2.5 sm:px-6">Office</th><th className="px-3 py-2.5">Sale</th><th className="px-3 py-2.5">Paid on</th><th className="px-3 py-2.5 text-right">Sale amount</th><th className="px-3 py-2.5 text-right">Commission</th><th className="px-5 py-2.5 sm:px-6">Status</th></tr></thead>
                <tbody>
                  {pending.map((s) => (
                    <tr key={s.id} className="border-b border-line"><td className="px-5 py-3 font-semibold sm:px-6">{d.offices.find((o) => o.id === s.officeId)?.name}</td><td className="px-3 py-3 text-ink-2">{s.description}</td><td className="px-3 py-3 text-muted">Waiting on payment</td><td className="px-3 py-3 text-right tabular-nums">{usd(s.amountCents)}</td><td className="px-3 py-3 text-right text-muted">—</td><td className="px-5 py-3 sm:px-6"><Badge>Not earned yet</Badge></td></tr>
                  ))}
                  {coms.map((c) => {
                    const s = d.sales.find((x) => x.id === c.saleId);
                    return (
                      <tr key={c.id} className="border-b border-line last:border-0">
                        <td className="px-5 py-3 sm:px-6">{s ? <Link href={`/monarch/offices/${s.officeId}`} className="font-semibold text-ink hover:text-accent">{d.offices.find((o) => o.id === s.officeId)?.name}</Link> : "—"}</td>
                        <td className="px-3 py-3 text-ink-2">{s?.description}</td>
                        <td className="px-3 py-3 text-ink-2">{shortDate(s?.paidAt)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{s ? usd(s.amountCents) : "—"}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums">{usd(c.amountCents)}</td>
                        <td className="px-5 py-3 sm:px-6"><Badge tone={c.status === "owed" ? "warning" : c.status === "paid" ? "success" : "neutral"}>{c.status === "owed" ? "Owed" : c.status === "paid" ? `Paid out ${shortDate(c.paidAt)}` : "Cancelled (refund)"}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty title="No commissions yet">Choose {r.name} as the reseller on an office; their paid sales show here.</Empty>}
        </Card>
      )}
      <ResellerDialog value={edit} onClose={() => setEdit(null)} onSaved={(id) => setSel(id)} />
    </div>
  );
}

function ResellerDialog({ value, onClose, onSaved }: { value: Reseller | "new" | null; onClose: () => void; onSaved: (id: string) => void }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [f, setF] = useState({ name: "", contact: "", email: "", phone: "", rate: "", notes: "", active: true });
  useEffect(() => {
    if (!value) return;
    setF(value === "new" ? { name: "", contact: "", email: "", phone: "", rate: "", notes: "", active: true } : { name: value.name, contact: value.contact, email: value.email, phone: value.phone, rate: String(value.rateBp / 100), notes: value.notes, active: value.active });
  }, [value]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const id = value && value !== "new" ? value.id : null;
  return (
    <Modal open={!!value} onClose={onClose} title={id ? "Edit reseller" : "Add reseller"}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.name.trim() || !!busy} onClick={() => void run("r", async () => { const rid = id ?? newId("rs"); await m.apply("PUT", `/api/monarch/catalog/resellers/${rid}`, f); onSaved(rid); onClose(); }, "Reseller saved")}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextField label="Name" required value={f.name} onChange={set("name")} placeholder="Company or person" /></div>
        <TextField label="Contact person" value={f.contact} onChange={set("contact")} />
        <TextField label="Commission rate (%)" inputMode="decimal" value={f.rate} onChange={set("rate")} placeholder="e.g. 20" />
        <TextField label="Email" type="email" value={f.email} onChange={set("email")} />
        <TextField label="Phone" type="tel" value={f.phone} onChange={set("phone")} />
        <div className="sm:col-span-2"><TextArea label="Notes" rows={2} value={f.notes} onChange={set("notes")} /></div>
        <Checkbox label="Active" hint="Inactive resellers can't be chosen on new offices" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
      </div>
      <p className="mt-3 text-[12px] text-muted">A rate change applies to sales paid from now on. Commissions already earned keep their rate.</p>
    </Modal>
  );
}
