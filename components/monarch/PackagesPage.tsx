"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { newId, useMonarch } from "@/lib/store/monarch-store";
import { BILLING_LABEL, KIND_LABEL, usd, type MonarchData, type Package } from "@/lib/monarch/types";
import { dollars, Empty, MonarchGate, useAct } from "./MonarchBits";

export function PackagesPage() {
  return <MonarchGate>{(d) => <Packages d={d} />}</MonarchGate>;
}

function Packages({ d }: { d: MonarchData }) {
  const [edit, setEdit] = useState<Package | "new" | null>(null);
  const sold = (id: string) => d.sales.filter((s) => s.packageId === id && s.status === "paid").reduce((n, s) => n + s.qty, 0);
  return (
    <div>
      <PageHeader title="Packages" subtitle={'What you sell. These show up in "Record a sale" and set what each office includes.'} actions={<Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>New package</Button>} />
      {d.packages.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.packages.map((p) => (
            <Card key={p.id} className={`flex flex-col gap-2 p-5 ${p.active ? "" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-2"><h2 className="text-[17px] font-bold text-ink">{p.name}</h2><Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Retired"}</Badge></div>
              <p><span className="text-[26px] font-bold text-ink">{usd(p.priceCents)}</span> <span className="text-[13px] text-muted">{p.kind === "package" ? BILLING_LABEL[p.billing] : "each"}</span></p>
              <p className="text-[12.5px] text-muted">{p.kind === "package" ? `${p.locations} location${p.locations === 1 ? "" : "s"} · ${p.seats} seat${p.seats === 1 ? "" : "s"}${p.askPtins ? " · asks for PTINs" : ""}` : KIND_LABEL[p.kind]} · {sold(p.id)} sold</p>
              {p.features.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{p.features.map((f, i) => <li key={i}>{f}</li>)}</ul>}
              <div className="mt-auto pt-2"><Button size="sm" icon={Pencil} onClick={() => setEdit(p)}>Edit</Button></div>
            </Card>
          ))}
        </section>
      ) : <Card><Empty title="No packages yet">Add your software packages, plus add-ons like an extra seat or extra location.</Empty></Card>}
      <PackageDialog value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function PackageDialog({ value, onClose }: { value: Package | "new" | null; onClose: () => void }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const empty = { name: "", kind: "package" as Package["kind"], price: "", billing: "season" as Package["billing"], locations: "1", seats: "1", askPtins: false, features: "", stripeLink: "", softwareId: "", bankId: "", active: true };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!value) return;
    setF(value === "new" ? empty : { name: value.name, kind: value.kind, price: dollars(value.priceCents), billing: value.billing, locations: String(value.locations), seats: String(value.seats), askPtins: value.askPtins, features: value.features.join("\n"), stripeLink: value.stripeLink ?? "", softwareId: value.softwareId ?? "", bankId: value.bankId ?? "", active: value.active });
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const id = value && value !== "new" ? value.id : null;
  const isPkg = f.kind === "package";
  return (
    <Modal open={!!value} onClose={onClose} title={id ? "Edit package" : "New package"} size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.name.trim() || !f.price || !!busy} onClick={() => void run("p", async () => { await m.apply("PUT", `/api/monarch/catalog/packages/${id ?? newId("pk")}`, { ...f, features: f.features.split("\n").map((x) => x.trim()).filter(Boolean) }); onClose(); }, "Package saved")}>Save package</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <SelectField label="Type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Package["kind"] })} options={[["package", "Software package"], ["seat", "Add-on: extra seat"], ["location", "Add-on: extra location"], ["other", "Other"]]} />
        <TextField label="Price" required inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0.00" />
        {isPkg && <SelectField label="Billing" value={f.billing} onChange={(e) => setF({ ...f, billing: e.target.value as Package["billing"] })} options={[["season", "Per season (yearly)"], ["once", "One time"], ["monthly", "Monthly"]]} />}
        {isPkg && <TextField label="Locations included" type="number" min={0} value={f.locations} onChange={(e) => setF({ ...f, locations: e.target.value })} />}
        {isPkg && <TextField label="Seats included" type="number" min={0} value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} />}
        <div className="sm:col-span-2"><TextArea label="What's included (one per line)" rows={4} value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} /></div>
        {isPkg && <SelectField label="Software that comes with it" value={f.softwareId} onChange={(e) => setF({ ...f, softwareId: e.target.value })} options={[["", "Choose later per office"], ...(m.data?.software ?? []).filter((x) => x.active || x.id === f.softwareId).map((x) => [x.id, x.name] as [string, string])]} />}
        {isPkg && <SelectField label="Bank product" value={f.bankId} onChange={(e) => setF({ ...f, bankId: e.target.value })} options={[["", "Choose later per office"], ...(m.data?.banks ?? []).filter((x) => x.active || x.id === f.bankId).map((x) => [x.id, x.name] as [string, string])]} />}
        {isPkg && <div className="sm:col-span-2"><TextField label="Stripe payment link (from your website)" value={f.stripeLink} onChange={(e) => setF({ ...f, stripeLink: e.target.value.trim() })} placeholder="https://buy.stripe.com/…" hint="When someone pays through this link, they're added as an office automatically and get the welcome email." /></div>}
        {isPkg && <Checkbox label="Ask offices for preparer names & PTINs" hint="Adds a Preparers step to their upload link" checked={f.askPtins} onChange={(e) => setF({ ...f, askPtins: e.target.checked })} />}
        <Checkbox label="Available for new sales" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
      </div>
      <p className="mt-3 text-[12px] text-muted">Price changes only affect new sales. Past sales keep the price they were sold at. Paying for an add-on adds it to the office automatically.</p>
    </Modal>
  );
}
