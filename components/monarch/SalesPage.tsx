"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Send, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMonarch } from "@/lib/store/monarch-store";
import { pct, usd, type MonarchData, type Sale } from "@/lib/monarch/types";
import { dollars, Empty, MonarchGate, SALE_LABEL, SALE_TONE, shortDate, Stat, TABLE_HEAD, useAct } from "./MonarchBits";

const METHODS = ["Cash", "Check", "Zelle", "Cash App", "Card (in person)", "Bank transfer", "Other"];
type Filter = "all" | Sale["status"];

export function SalesPage() {
  return <MonarchGate>{(d) => <Sales d={d} />}</MonarchGate>;
}

function Sales({ d }: { d: MonarchData }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [filter, setFilter] = useState<Filter>("all");
  const [paying, setPaying] = useState<Sale | null>(null);
  const [method, setMethod] = useState("Cash");
  const name = (id: string) => d.offices.find((o) => o.id === id)?.name ?? "—";
  const rows = d.sales.filter((s) => filter === "all" || s.status === filter);
  const month = new Date().toISOString().slice(0, 7);
  const paidMonth = d.sales.filter((s) => s.status === "paid" && (s.paidAt ?? "").startsWith(month));
  const unpaid = d.sales.filter((s) => s.status === "unpaid");
  const act = (s: Sale, action: string, extra: Record<string, unknown> = {}, ok?: string) => run(`${action}:${s.id}`, () => m.apply("POST", `/api/monarch/sales/${s.id}`, { action, ...extra }), ok);

  return (
    <div>
      <PageHeader title="Sales & Payments" subtitle="Packages and add-ons sold to offices, and how they were paid." />
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid this month" value={usd(paidMonth.reduce((n, s) => n + s.amountCents, 0))} sub={`${paidMonth.length} sale${paidMonth.length === 1 ? "" : "s"}`} bar="var(--success)" />
        <Stat label="Unpaid" value={usd(unpaid.reduce((n, s) => n + s.amountCents, 0))} sub={`${unpaid.length} waiting on payment`} bar="var(--warning)" />
        <Stat label="Sales (all time)" value={d.sales.filter((s) => s.status === "paid").length} sub="paid" bar="var(--accent)" />
        <Stat label="Online payment" value={d.stripe ? "On" : "Off"} sub={d.stripe ? "Pay links go through Stripe" : "Stripe isn't connected — record payments by hand"} bar="var(--svc-books)" />
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 sm:px-6">
            <h2 className="mr-auto text-[16px] font-bold text-ink">All sales</h2>
            {(["all", "unpaid", "paid", "refunded"] as Filter[]).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`h-8 rounded-lg px-3 text-[13px] font-semibold ${filter === f ? "bg-accent text-white" : "border border-line bg-surface text-ink-2 hover:bg-surface-hover"}`}>{f === "all" ? "All" : SALE_LABEL[f]}</button>)}
          </div>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13.5px]">
                <thead className={TABLE_HEAD}><tr><th className="px-5 py-2.5 sm:px-6">Office</th><th className="px-3 py-2.5">What they bought</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Payment</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-5 py-2.5 sm:px-6" /></tr></thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 sm:px-6"><Link href={`/monarch/offices/${s.officeId}`} className="font-semibold text-ink hover:text-accent">{name(s.officeId)}</Link><span className="block text-[12px] text-muted">{s.resellerId ? d.resellers.find((r) => r.id === s.resellerId)?.name : "Direct"}</span></td>
                      <td className="px-3 py-3 text-ink-2">{s.description}</td>
                      <td className="px-3 py-3 text-ink-2">{shortDate(s.paidAt ?? s.createdAt)}</td>
                      <td className="px-3 py-3"><Badge tone={SALE_TONE[s.status]}>{SALE_LABEL[s.status]}</Badge>{s.method && <span className="block text-[11.5px] text-muted">{s.method}</span>}{s.status === "unpaid" && s.linkSentAt && <span className="block text-[11.5px] text-muted">Link sent {shortDate(s.linkSentAt)}</span>}</td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">{usd(s.amountCents)}</td>
                      <td className="px-5 py-3 text-right sm:px-6">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {s.status === "unpaid" && <><Button size="sm" icon={Check} disabled={!!busy} onClick={() => { setMethod("Cash"); setPaying(s); }}>Paid</Button>{d.stripe && <Button size="sm" icon={Send} disabled={!!busy} onClick={() => void act(s, "link", {}, "Pay link emailed")}>{s.linkSentAt ? "Resend link" : "Pay link"}</Button>}<Button size="sm" variant="ghost" icon={X} disabled={!!busy} onClick={() => confirm("Cancel this unpaid sale?") && void act(s, "void", {}, "Sale cancelled")}>Cancel</Button></>}
                          {s.status === "paid" && <Button size="sm" variant="ghost" icon={Undo2} disabled={!!busy} onClick={() => confirm(`Mark this ${usd(s.amountCents)} sale refunded? Refund the money in Stripe or by hand first — this only records it. Any commission on it is cancelled.`) && void act(s, "refund", {}, "Marked refunded")}>Refund</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty title="No sales here yet">Record a sale with the form.</Empty>}
        </Card>
        <RecordSale d={d} />
      </div>
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Record payment" description={paying ? `${paying.description} — ${usd(paying.amountCents)}` : undefined}
        footer={<><Button onClick={() => setPaying(null)}>Cancel</Button><Button variant="primary" disabled={!!busy} onClick={() => paying && void act(paying, "paid", { method }, "Payment recorded").then(() => setPaying(null))}>Mark paid</Button></>}>
        <SelectField label="How did they pay?" value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS.map((x): [string, string] => [x, x])} />
      </Modal>
    </div>
  );
}

function RecordSale({ d }: { d: MonarchData }) {
  const m = useMonarch();
  const params = useSearchParams();
  const { busy, run } = useAct();
  const [officeId, setOfficeId] = useState(params.get("office") ?? "");
  const [packageId, setPackageId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [payment, setPayment] = useState<"link" | "paid" | "later">(d.stripe ? "link" : "paid");
  const [method, setMethod] = useState("Cash");
  const office = d.offices.find((o) => o.id === officeId);
  const pkgs = d.packages.filter((p) => p.active);
  const pkg = d.packages.find((p) => p.id === packageId);
  useEffect(() => { if (pkg) setPrice(dollars(pkg.priceCents)); }, [pkg]);
  useEffect(() => { const o = params.get("office"); if (o) setOfficeId(o); }, [params]);
  const total = Math.round((Number(price.replace(/[$,]/g, "")) || 0) * 100) * (Number(qty) || 0);
  const reseller = d.resellers.find((r) => r.id === office?.resellerId);
  const offices = useMemo(() => [...d.offices].filter((o) => o.stage !== "inactive" || o.id === officeId).sort((a, b) => a.name.localeCompare(b.name)), [d.offices, officeId]);

  const save = () => run("sale", async () => {
    const r = await m.apply<{ emailed?: boolean }>("POST", "/api/monarch/sales", { officeId, packageId, qty: Number(qty), price, description, payment, method });
    setPackageId(""); setQty("1"); setPrice(""); setDescription("");
    return r;
  }, (r) => payment === "link" ? (r.emailed ? `Sale saved — pay link emailed to ${office?.email}` : "Sale saved — email isn't connected, so the pay link is in the outbox") : "Sale saved");

  return (
    <Card className="h-fit">
      <CardHeader title="Record a sale" />
      <div className="space-y-3.5 border-t border-line px-5 py-4 sm:px-6">
        <SelectField label="Office" required value={officeId} onChange={(e) => setOfficeId(e.target.value)} options={[["", "Choose an office"], ...offices.map((o): [string, string] => [o.id, o.name])]} />
        <SelectField label="Package or add-on" value={packageId} onChange={(e) => setPackageId(e.target.value)} options={[["", "Something else (describe below)"], ...pkgs.map((p): [string, string] => [p.id, `${p.name} — ${usd(p.priceCents)}`])]} />
        {!pkg && <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was sold" />}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Quantity" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          <TextField label="Price each" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">Payment</legend>
          {d.stripe && <Choice on={payment === "link"} onPick={() => setPayment("link")} title="Email a pay-online link" text="Stripe link by email; marked paid automatically when they pay." />}
          <Choice on={payment === "paid"} onPick={() => setPayment("paid")} title="Already paid" text="Cash, check, Zelle or card in person." />
          <Choice on={payment === "later"} onPick={() => setPayment("later")} title="Not paid yet" text="Save it as unpaid and collect later." />
          {payment === "paid" && <SelectField label="How did they pay?" value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS.map((x): [string, string] => [x, x])} />}
        </fieldset>
        {reseller && reseller.rateBp > 0 && <p className="rounded-xl bg-accent-soft px-3 py-2 text-[12.5px] text-accent-ink">Brought in by <b>{reseller.name}</b> — a {usd(Math.round((total * reseller.rateBp) / 10_000))} commission ({pct(reseller.rateBp)}) is created once this is paid.</p>}
        <div className="flex items-center justify-between border-t border-line pt-3"><span className="text-[13px] text-muted">Total</span><span className="text-[18px] font-bold text-ink">{usd(total)}</span></div>
        <Button variant="primary" className="w-full" disabled={!officeId || total <= 0 || (!pkg && !description.trim()) || busy === "sale" || (payment === "link" && !office?.email)} onClick={() => void save()}>{busy === "sale" ? "Saving…" : payment === "link" ? "Save & email pay link" : "Save sale"}</Button>
        {payment === "link" && office && !office.email && <p className="text-[12px] text-warning-ink">Add {office.name}&rsquo;s email address first.</p>}
      </div>
    </Card>
  );
}

function Choice({ on, onPick, title, text }: { on: boolean; onPick: () => void; title: string; text: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] ring-1 ${on ? "bg-accent-soft ring-accent" : "ring-line hover:bg-surface-hover"}`}>
      <input type="radio" checked={on} onChange={onPick} className="mt-1" />
      <span><b className="text-ink">{title}</b><span className="block text-[12.5px] text-muted">{text}</span></span>
    </label>
  );
}
