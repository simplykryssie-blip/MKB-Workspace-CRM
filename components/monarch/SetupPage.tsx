"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox, TextArea, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { newId, useMonarch } from "@/lib/store/monarch-store";
import { usd, type Bank, type MonarchData, type Software } from "@/lib/monarch/types";
import { dollars, Empty, MonarchGate, TABLE_HEAD, useAct } from "./MonarchBits";

export function SetupPage() {
  return <MonarchGate>{(d) => <Setup d={d} />}</MonarchGate>;
}

const DEFAULT_WELCOME = `Hi {contact name},

{office name} is set up on {software} for the season.

Download: {download link}
Username: {username}

Your password comes separately on our setup call.`;

function Setup({ d }: { d: MonarchData }) {
  const [sw, setSw] = useState<Software | "new" | null>(null);
  const [bk, setBk] = useState<Bank | "new" | null>(null);
  const used = (k: "softwareId" | "bankId", id: string) => d.offices.filter((o) => o[k] === id).length;
  const yes = (v: boolean, label = "Saved") => <span className={v ? "font-semibold text-success-ink" : "text-warning-ink"}>{v ? <><Check size={13} className="mr-1 inline" />{label}</> : "Not added"}</span>;
  return (
    <div>
      <PageHeader title="Setup" subtitle="The software and banks you offer, your fees, and what offices receive." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Software products" subtitle="Your service bureau fee, download link and welcome email for each" action={<Button size="sm" icon={Plus} onClick={() => setSw("new")}>Add software</Button>} />
          {d.software.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[13.5px]">
              <thead className={TABLE_HEAD}><tr><th className="px-5 py-2.5 sm:px-6">Software</th><th className="px-3 py-2.5 text-right">Your SB fee</th><th className="px-3 py-2.5">Download link</th><th className="px-3 py-2.5 text-right">Offices</th><th className="px-5 py-2.5 sm:px-6" /></tr></thead>
              <tbody>{d.software.map((s) => <tr key={s.id} className="border-b border-line last:border-0"><td className="px-5 py-3 font-semibold text-ink sm:px-6">{s.name} {!s.active && <Badge>Not offered</Badge>}</td><td className="px-3 py-3 text-right tabular-nums">{usd(s.sbFeeCents)}</td><td className="px-3 py-3">{yes(!!s.downloadUrl)}</td><td className="px-3 py-3 text-right">{used("softwareId", s.id)}</td><td className="px-5 py-3 text-right sm:px-6"><Button size="sm" variant="ghost" icon={Pencil} onClick={() => setSw(s)}>Edit</Button></td></tr>)}</tbody>
            </table></div>
          ) : <Empty title="No software yet">Add each tax software product you sell.</Empty>}
        </Card>
        <Card>
          <CardHeader title="Banks" subtitle="Your add-on fee, application link and saved report layouts" action={<Button size="sm" icon={Plus} onClick={() => setBk("new")}>Add bank</Button>} />
          {d.banks.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[13.5px]">
              <thead className={TABLE_HEAD}><tr><th className="px-5 py-2.5 sm:px-6">Bank</th><th className="px-3 py-2.5 text-right">Your add-on</th><th className="px-3 py-2.5">Application link</th><th className="px-3 py-2.5">Report layouts</th><th className="px-3 py-2.5 text-right">Offices</th><th className="px-5 py-2.5 sm:px-6" /></tr></thead>
              <tbody>{d.banks.map((b) => <tr key={b.id} className="border-b border-line last:border-0"><td className="px-5 py-3 font-semibold text-ink sm:px-6">{b.name} {!b.active && <Badge>Not offered</Badge>}</td><td className="px-3 py-3 text-right tabular-nums">{usd(b.addonFeeCents)}</td><td className="px-3 py-3">{yes(!!b.applicationUrl)}</td><td className="px-3 py-3 text-ink-2">{[b.layouts.enrollment && "Enrollment", b.layouts.funded && "Funded"].filter(Boolean).join(", ") || <span className="text-muted">None yet</span>}</td><td className="px-3 py-3 text-right">{used("bankId", b.id)}</td><td className="px-5 py-3 text-right sm:px-6"><Button size="sm" variant="ghost" icon={Pencil} onClick={() => setBk(b)}>Edit</Button></td></tr>)}</tbody>
            </table></div>
          ) : <Empty title="No banks yet">Add each bank you offer bank products through.</Empty>}
        </Card>
        <LinkSettings d={d} />
        <Contact d={d} />
        <div className="xl:col-span-2"><Agreement d={d} /></div>
      </div>
      <SoftwareDialog value={sw} onClose={() => setSw(null)} />
      <BankDialog value={bk} onClose={() => setBk(null)} />
    </div>
  );
}

function LinkSettings({ d }: { d: MonarchData }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [days, setDays] = useState(String(d.settings.linkDays));
  const [close, setClose] = useState(d.settings.closeOnActive);
  const [auto, setAuto] = useState(d.settings.autoWelcome);
  useEffect(() => { setDays(String(d.settings.linkDays)); setClose(d.settings.closeOnActive); setAuto(d.settings.autoWelcome); }, [d.settings]);
  const dirty = days !== String(d.settings.linkDays) || close !== d.settings.closeOnActive || auto !== d.settings.autoWelcome;
  return (
    <Card>
      <CardHeader title="Upload links" subtitle="The private link offices use to send documents — no login" />
      <div className="space-y-3 border-t border-line px-5 py-4 sm:px-6">
        <TextField label="Stop working after this many days unused" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
        <Checkbox label="Turn the link off when onboarding is complete" checked={close} onChange={(e) => setClose(e.target.checked)} />
        <Checkbox label="Email the welcome automatically when a package is paid" hint="Their setup link, what we need, and the software and bank applications — whether they paid by link, on your website, or you recorded it by hand." checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        <p className="text-[12.5px] text-muted">Sending a new link always replaces the old one. Each time the office uses the link, the clock starts over.</p>
        {dirty && <Button size="sm" variant="primary" disabled={!!busy} onClick={() => void run("l", () => m.saveSettings({ linkDays: Number(days), closeOnActive: close, autoWelcome: auto }), "Saved")}>Save</Button>}
      </div>
    </Card>
  );
}

function Contact({ d }: { d: MonarchData }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [phone, setPhone] = useState(d.settings.phone);
  const [email, setEmail] = useState(d.settings.email);
  useEffect(() => { setPhone(d.settings.phone); setEmail(d.settings.email); }, [d.settings]);
  const dirty = phone !== d.settings.phone || email !== d.settings.email;
  return (
    <Card>
      <CardHeader title="Monarch contact details" subtitle="Shown at the bottom of Monarch emails and on the upload link" />
      <div className="grid gap-3 border-t border-line px-5 py-4 sm:grid-cols-2 sm:px-6">
        <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {dirty && <div className="sm:col-span-2"><Button size="sm" variant="primary" disabled={!!busy} onClick={() => void run("c", () => m.saveSettings({ phone, email }), "Saved")}>Save</Button></div>}
      </div>
    </Card>
  );
}

function Agreement({ d }: { d: MonarchData }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [text, setText] = useState(d.settings.agreement.text);
  useEffect(() => setText(d.settings.agreement.text), [d.settings.agreement.text]);
  const signed = d.offices.filter((o) => o.agreement).length;
  return (
    <Card>
      <CardHeader title="Service bureau agreement" subtitle={`Version ${d.settings.agreement.version} · offices sign it online on their upload link · ${signed} signed`} />
      <div className="border-t border-line px-5 py-4 sm:px-6">
        <TextArea label="Agreement text" rows={14} value={text} onChange={(e) => setText(e.target.value)} />
        <p className="mt-2 text-[12.5px] text-muted">Start a line with &ldquo;## &rdquo; for a heading and &ldquo;- &rdquo; for a bullet. Saving a change makes a new version; offices that already signed keep their signed copy.</p>
        {text !== d.settings.agreement.text && <Button className="mt-3" size="sm" variant="primary" disabled={!!busy} onClick={() => void run("a", () => m.saveSettings({ agreement: text }), "Agreement saved as a new version")}>Save new version</Button>}
      </div>
    </Card>
  );
}

function SoftwareDialog({ value, onClose }: { value: Software | "new" | null; onClose: () => void }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [f, setF] = useState({ name: "", sbFee: "", downloadUrl: "", applicationUrl: "", welcomeSubject: "", welcomeBody: DEFAULT_WELCOME, active: true });
  useEffect(() => {
    if (!value) return;
    setF(value === "new" ? { name: "", sbFee: "", downloadUrl: "", applicationUrl: "", welcomeSubject: "", welcomeBody: DEFAULT_WELCOME, active: true } : { name: value.name, sbFee: dollars(value.sbFeeCents), downloadUrl: value.downloadUrl, applicationUrl: value.applicationUrl ?? "", welcomeSubject: value.welcomeSubject, welcomeBody: value.welcomeBody || DEFAULT_WELCOME, active: value.active });
  }, [value]);
  const id = value && value !== "new" ? value.id : null;
  return (
    <Modal open={!!value} onClose={onClose} title={id ? "Edit software" : "Add software"} size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.name.trim() || !!busy} onClick={() => void run("s", async () => { await m.apply("PUT", `/api/monarch/catalog/software/${id ?? newId("sw")}`, f); onClose(); }, "Software saved")}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. the product and edition" />
        <TextField label="Your service bureau fee (per funded return)" inputMode="decimal" value={f.sbFee} onChange={(e) => setF({ ...f, sbFee: e.target.value })} placeholder="0.00" />
        <div className="sm:col-span-2"><TextField label="Onboarding application link" type="url" value={f.applicationUrl} onChange={(e) => setF({ ...f, applicationUrl: e.target.value })} placeholder="https://" hint="The software company's new-office application. It goes in the welcome email new offices get after paying." /></div>
        <div className="sm:col-span-2"><TextField label="Download link" type="url" value={f.downloadUrl} onChange={(e) => setF({ ...f, downloadUrl: e.target.value })} placeholder="https://" /></div>
        <div className="sm:col-span-2"><TextField label="Welcome email subject" value={f.welcomeSubject} onChange={(e) => setF({ ...f, welcomeSubject: e.target.value })} placeholder="{office name} is set up on {software}" /></div>
        <div className="sm:col-span-2"><TextArea label="Welcome email" rows={9} value={f.welcomeBody} onChange={(e) => setF({ ...f, welcomeBody: e.target.value })} /></div>
        <p className="text-[12px] text-muted sm:col-span-2">Fill-ins: {"{contact name}"}, {"{office name}"}, {"{software}"}, {"{download link}"}, {"{username}"}. Passwords are never emailed. You still set your actual fee in the software or bank enrollment — Monarch uses it to check bank reports.</p>
        <Checkbox label="Offered to new offices" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
      </div>
    </Modal>
  );
}

function BankDialog({ value, onClose }: { value: Bank | "new" | null; onClose: () => void }) {
  const m = useMonarch();
  const { busy, run } = useAct();
  const [f, setF] = useState({ name: "", addonFee: "", applicationUrl: "", active: true });
  useEffect(() => {
    if (!value) return;
    setF(value === "new" ? { name: "", addonFee: "", applicationUrl: "", active: true } : { name: value.name, addonFee: dollars(value.addonFeeCents), applicationUrl: value.applicationUrl, active: value.active });
  }, [value]);
  const id = value && value !== "new" ? value.id : null;
  return (
    <Modal open={!!value} onClose={onClose} title={id ? "Edit bank" : "Add bank"}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.name.trim() || !!busy} onClick={() => void run("b", async () => { await m.apply("PUT", `/api/monarch/catalog/banks/${id ?? newId("bk")}`, f); onClose(); }, "Bank saved")}>Save</Button></>}>
      <div className="grid gap-3">
        <TextField label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField label="Your add-on fee (per bank product)" inputMode="decimal" value={f.addonFee} onChange={(e) => setF({ ...f, addonFee: e.target.value })} placeholder="0.00" />
        <TextField label="Application link" type="url" value={f.applicationUrl} onChange={(e) => setF({ ...f, applicationUrl: e.target.value })} placeholder="https://" hint="Goes in the welcome email new offices get after paying (and with “Email bank application”)." />
        <Checkbox label="Offered to new offices" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
      </div>
    </Modal>
  );
}
