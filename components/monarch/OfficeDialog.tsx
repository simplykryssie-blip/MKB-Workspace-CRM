"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextField } from "@/components/ui/Field";
import { newId, useMonarch } from "@/lib/store/monarch-store";
import { usd, type MonarchData, type Office } from "@/lib/monarch/types";
import { useAct } from "./MonarchBits";

type Form = { name: string; contactName: string; email: string; phone: string; city: string; state: string; packageId: string; softwareId: string; bankId: string; resellerId: string };
const blank: Form = { name: "", contactName: "", email: "", phone: "", city: "", state: "", packageId: "", softwareId: "", bankId: "", resellerId: "" };

/** Add a new office, or edit an existing office's details. */
export function OfficeDialog({ open, onClose, data, office }: { open: boolean; onClose: () => void; data: MonarchData; office?: Office }) {
  const m = useMonarch();
  const router = useRouter();
  const { busy, run } = useAct();
  const [f, setF] = useState<Form>(blank);
  useEffect(() => {
    if (!open) return;
    setF(office ? { name: office.name, contactName: office.contactName, email: office.email, phone: office.phone, city: office.city, state: office.state, packageId: office.packageId ?? "", softwareId: office.softwareId ?? "", bankId: office.bankId ?? "", resellerId: office.resellerId ?? "" } : blank);
  }, [open, office]);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const pk = data.packages.filter((p) => p.kind === "package" && (p.active || p.id === f.packageId));
  const sw = data.software.filter((s) => s.active || s.id === f.softwareId);
  const bk = data.banks.filter((b) => b.active || b.id === f.bankId);
  const rs = data.resellers.filter((r) => r.active || r.id === f.resellerId);

  const save = () => run("save", async () => {
    if (office) {
      await m.applyOffice("PUT", `/api/monarch/offices/${office.id}`, { rev: office.rev, patch: f });
      onClose();
    } else {
      const r = await m.apply<{ id: string }>("POST", "/api/monarch/offices", { id: newId("of"), ...f });
      onClose();
      router.push(`/monarch/offices/${r.id}`);
    }
  }, office ? "Office saved" : "Office added");

  return (
    <Modal open={open} onClose={onClose} title={office ? "Edit office" : "New office"} description={office ? undefined : "A tax office (ERO) you're selling to or onboarding."} size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.name.trim() || busy === "save"} onClick={() => void save()}>{busy === "save" ? "Saving…" : office ? "Save" : "Add office"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextField label="Office name" required value={f.name} onChange={set("name")} placeholder="e.g. Gulf Coast Tax Pros" /></div>
        <TextField label="Contact name" value={f.contactName} onChange={set("contactName")} />
        <TextField label="Email" type="email" value={f.email} onChange={set("email")} hint="Upload links and emails go here" />
        <TextField label="Phone" type="tel" value={f.phone} onChange={set("phone")} />
        <div className="grid grid-cols-[1fr_88px] gap-3"><TextField label="City" value={f.city} onChange={set("city")} /><TextField label="State" value={f.state} maxLength={2} onChange={set("state")} /></div>
        <SelectField label="Package" value={f.packageId} onChange={set("packageId")} options={[["", "Not chosen yet"], ...pk.map((p): [string, string] => [p.id, `${p.name} — ${usd(p.priceCents)}`])]} />
        <SelectField label="Software" value={f.softwareId} onChange={set("softwareId")} options={[["", "Not chosen yet"], ...sw.map((s): [string, string] => [s.id, s.name])]} />
        <SelectField label="Bank" value={f.bankId} onChange={set("bankId")} options={[["", "Not chosen yet"], ...bk.map((b): [string, string] => [b.id, b.name])]} />
        <SelectField label="Brought in by (reseller)" value={f.resellerId} onChange={set("resellerId")} options={[["", "Direct — no reseller"], ...rs.map((r): [string, string] => [r.id, r.name])]} />
      </div>
      {!data.packages.length && <p className="mt-3 text-[12.5px] text-muted">Tip: add your packages, software and banks in Setup so you can pick them here.</p>}
    </Modal>
  );
}
