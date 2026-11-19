"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ImagePlus, Pencil, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { newId, useMonarch } from "@/lib/store/monarch-store";
import { BILLING_LABEL, DELIVERY_LABEL, KIND_LABEL, usd, type Delivery, type MonarchData, type Package, type StoreInfo } from "@/lib/monarch/types";
import { dollars, Empty, MonarchGate, useAct } from "./MonarchBits";

export function PackagesPage() {
  return <MonarchGate>{(d) => <Packages d={d} />}</MonarchGate>;
}

function Packages({ d }: { d: MonarchData }) {
  const [edit, setEdit] = useState<Package | "new" | null>(null);
  const sold = (id: string) => d.sales.filter((s) => s.packageId === id && s.status === "paid").reduce((n, s) => n + s.qty, 0);
  return (
    <div>
      <PageHeader title="Packages" subtitle={'What you sell. These show up in "Record a sale" and set what each office includes. Switch on "Show in the store" to sell one on your website at /store.'} actions={<Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>New package</Button>} />
      {d.packages.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.packages.map((p) => (
            <Card key={p.id} className={`flex flex-col gap-2 p-5 ${p.active ? "" : "opacity-70"}`}>
              {p.store.images[0] && <img src={`/site/media/${p.store.images[0]}`} alt="" className="aspect-[16/9] w-full rounded-lg bg-surface-2 object-cover" />}
              <div className="flex items-start justify-between gap-2"><h2 className="text-[17px] font-bold text-ink">{p.name}</h2><span className="flex shrink-0 gap-1">{p.store.listed && p.active && <Badge tone="info">In store</Badge>}<Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Retired"}</Badge></span></div>
              <p><span className="text-[26px] font-bold text-ink">{usd(p.priceCents)}</span> <span className="text-[13px] text-muted">{p.kind === "package" ? BILLING_LABEL[p.billing] : "each"}</span></p>
              <p className="text-[12.5px] text-muted">{p.kind === "package" ? `${p.locations} location${p.locations === 1 ? "" : "s"} · ${p.seats} seat${p.seats === 1 ? "" : "s"}${p.askPtins ? " · asks for PTINs" : ""}` : KIND_LABEL[p.kind]} · {sold(p.id)} sold</p>
              {p.features.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">{p.features.map((f, i) => <li key={i}>{f}</li>)}</ul>}
              <div className="mt-auto flex flex-wrap gap-2 pt-2"><Button size="sm" icon={Pencil} onClick={() => setEdit(p)}>Edit</Button>{p.store.listed && p.active && p.store.slug && <a href={`/msite/store/${p.store.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-2 hover:bg-surface-2"><ExternalLink size={14} /> Store page</a>}</div>
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
  const toast = useToast();
  const noStore: StoreInfo = { listed: false, slug: "", stripePrice: "", summary: "", description: "", terms: "", disclaimer: "", images: [], afterPurchase: "", position: 0, delivery: "none", files: [] };
  const empty = { name: "", kind: "package" as Package["kind"], price: "", billing: "season" as Package["billing"], locations: "1", seats: "1", askPtins: false, features: "", stripeLink: "", softwareId: "", bankId: "", active: true, store: noStore };
  const [uploading, setUploading] = useState(false);
  const fileOp = async (method: "POST" | "DELETE", path: string, file?: File) => {
    setUploading(true);
    try {
      const r = await fetch(path, { method, credentials: "same-origin", headers: file ? { "content-type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name) } : {}, body: file });
      const d = (await r.json().catch(() => ({}))) as { error?: string; packages?: Package[] };
      if (!r.ok) throw new Error(d.error ?? "That didn't work.");
      const p = d.packages?.find((x) => x.id === id);
      if (p) setF((x) => ({ ...x, store: { ...x.store, files: p.store.files } }));
      await m.reload();
    } catch (e) { toast(e instanceof Error ? e.message : "That didn't work.", "info"); }
    setUploading(false);
  };
  const addImage = async (file: File) => {
    setUploading(true);
    try {
      const r = await fetch("/api/website/media?site=monarch", { method: "POST", credentials: "same-origin", headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) }, body: file });
      const d = (await r.json().catch(() => ({}))) as { key?: string; error?: string };
      if (!r.ok || !d.key) throw new Error(d.error ?? "Upload failed.");
      setF((x) => ({ ...x, store: { ...x.store, images: [...x.store.images, d.key!].slice(0, 8) } }));
    } catch (e) { toast(e instanceof Error ? e.message : "Upload failed", "info"); }
    setUploading(false);
  };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (!value) return;
    setF(value === "new" ? empty : { name: value.name, kind: value.kind, price: dollars(value.priceCents), billing: value.billing, locations: String(value.locations), seats: String(value.seats), askPtins: value.askPtins, features: value.features.join("\n"), stripeLink: value.stripeLink ?? "", softwareId: value.softwareId ?? "", bankId: value.bankId ?? "", active: value.active, store: value.store ?? noStore });
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
      <div className="mt-5 rounded-xl border border-line p-4">
        <Checkbox label="Show in the store" hint="Gives it its own page on your Monarch website (/store) with a Buy now button. Buyers pay by card through Stripe and are added as an office automatically." checked={f.store.listed} onChange={(e) => setF({ ...f, store: { ...f.store, listed: e.target.checked } })} />
        {f.store.listed && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextField label="Web address" value={f.store.slug} onChange={(e) => setF({ ...f, store: { ...f.store, slug: e.target.value } })} placeholder="made from the name" hint={`/store/${f.store.slug || "…"}`} />
            <TextField label="Order in the store" type="number" min={0} value={String(f.store.position)} onChange={(e) => setF({ ...f, store: { ...f.store, position: Number(e.target.value) || 0 } })} hint="Lower numbers show first" />
            <div className="sm:col-span-2"><TextField label="Stripe price ID (optional)" value={f.store.stripePrice ?? ""} onChange={(e) => setF({ ...f, store: { ...f.store, stripePrice: e.target.value.trim() } })} placeholder="price_…" hint="From this product's price in your Monarch Stripe account. Lets coupons limited to this product work. It must be the same amount as the price above." /></div>
            <div className="sm:col-span-2"><TextArea label="Short summary" rows={2} value={f.store.summary} onChange={(e) => setF({ ...f, store: { ...f.store, summary: e.target.value } })} placeholder="One or two sentences under the name" /></div>
            <div className="sm:col-span-2"><TextArea label="Description" rows={5} value={f.store.description} onChange={(e) => setF({ ...f, store: { ...f.store, description: e.target.value } })} placeholder="A blank line starts a new paragraph" /></div>
            <div className="sm:col-span-2"><TextArea label="Purchase terms" rows={4} value={f.store.terms} onChange={(e) => setF({ ...f, store: { ...f.store, terms: e.target.value } })} /></div>
            <div className="sm:col-span-2"><TextArea label="Disclaimer" rows={3} value={f.store.disclaimer} onChange={(e) => setF({ ...f, store: { ...f.store, disclaimer: e.target.value } })} /></div>
            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
              <SelectField label="What the buyer gets automatically" value={f.store.delivery} onChange={(e) => setF({ ...f, store: { ...f.store, delivery: e.target.value as Delivery } })} options={(Object.keys(DELIVERY_LABEL) as Delivery[]).map((k) => [k, DELIVERY_LABEL[k]] as [string, string])} />
              {f.store.delivery.startsWith("calculator") && <TextField label="Tax year it delivers" inputMode="numeric" value={String(f.store.taxYear ?? "")} onChange={(e) => setF({ ...f, store: { ...f.store, taxYear: Number(e.target.value) || undefined } })} placeholder="2026" hint={f.store.delivery === "calculator_license" ? "A new license for this year + setup link email" : "Added to the buyer's existing license"} />}
            </div>
            {f.store.delivery === "download" && (
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-[13px] font-medium text-ink">Files the buyer downloads</p>
                {id ? (
                  <>
                    <ul className="space-y-1.5">{f.store.files.map((x) => <li key={x.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[13px] text-ink"><span className="truncate">{x.name}</span><button type="button" aria-label={`Remove ${x.name}`} disabled={uploading} onClick={() => { if (confirm(`Remove ${x.name}? New buyers won't get it.`)) void fileOp("DELETE", `/api/monarch/catalog/packages/${id}/files/${x.id}`); }}><X size={14} className="text-muted" /></button></li>)}</ul>
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-[13px] text-ink-2 hover:bg-surface-2"><Plus size={14} /> Add a file (up to 25 MB)<input type="file" className="sr-only" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void fileOp("POST", `/api/monarch/catalog/packages/${id}/files`, file); e.target.value = ""; }} /></label>
                  </>
                ) : <p className="text-[12.5px] text-muted">Save the package first, then add its files.</p>}
              </div>
            )}
            <div className="sm:col-span-2"><TextArea label="After they pay" rows={3} value={f.store.afterPurchase} onChange={(e) => setF({ ...f, store: { ...f.store, afterPurchase: e.target.value } })} placeholder="Shown on the thank-you page and emailed to the buyer (software packages get the welcome email instead)" /></div>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-medium text-ink">Pictures</p>
              <div className="flex flex-wrap gap-2">
                {f.store.images.map((k) => (
                  <span key={k} className="relative">
                    <img src={`/site/media/${k}`} alt="" className="h-20 w-20 rounded-lg border border-line object-cover" />
                    <button type="button" aria-label="Remove picture" onClick={() => setF({ ...f, store: { ...f.store, images: f.store.images.filter((x) => x !== k) } })} className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-white"><X size={13} /></button>
                  </span>
                ))}
                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line text-muted hover:bg-surface-2" aria-label="Add a picture">
                  <ImagePlus size={20} />
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void addImage(file); e.target.value = ""; }} />
                </label>
              </div>
              <p className="mt-1 text-[12px] text-muted">The first picture is the main one.</p>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-[12px] text-muted">Price changes only affect new sales. Past sales keep the price they were sold at. Paying for an add-on adds it to the office automatically.</p>
    </Modal>
  );
}
