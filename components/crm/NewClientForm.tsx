"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Building2, Lock, ShieldCheck, User } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox, SelectField, TextField } from "@/components/ui/Field";
import { AddressFields, DOBInput, EINInput, EmailInput, PhoneInput, ResponsiblePartyFields, TaxIdInput } from "@/components/ui/FormattedInputs";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { useToast } from "@/components/ui/Toast";
import { SERVICES, SERVICE_ORDER } from "@/lib/sample-data";
import { STAFF } from "@/lib/sample/clients";
import { useClients } from "@/lib/store/clients-store";
import {
  digits,
  dobToIso,
  normalizeEmail,
  validateAddress,
  validateDOB,
  validateEIN,
  validateEmail,
  validatePhone,
  validateTaxId,
  type Address,
  type TaxIdType,
} from "@/lib/validation";
import type { Client, ServiceKey } from "@/lib/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
type Entity = NonNullable<Client["business"]>["entityType"];

export function NewClientForm() {
  const router = useRouter();
  const store = useClients();
  const toast = useToast();
  const CLIENTS = store.clients;

  const [type, setType] = useState<"individual" | "business">("individual");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [entity, setEntity] = useState<Entity>("LLC");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState<Address>({ line1: "", line2: "", city: "", state: "GA", zip: "" });
  const [dob, setDob] = useState("");
  const [taxIdType, setTaxIdType] = useState<TaxIdType>("SSN");
  const [taxId, setTaxId] = useState("");
  const [ein, setEin] = useState("");
  const [rpName, setRpName] = useState("");
  const [rpTitle, setRpTitle] = useState("Owner");
  const [rpTaxIdType, setRpTaxIdType] = useState<TaxIdType>("SSN");
  const [rpTaxId, setRpTaxId] = useState("");
  const [deferTax, setDeferTax] = useState(false);
  const [services, setServices] = useState<ServiceKey[]>([]);
  const [staff, setStaff] = useState<string[]>([]);
  const [invite, setInvite] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const taxRequired = services.includes("tax") && !deferTax;

  // Duplicate detection: same email, same phone, similar name, or same EIN last-4.
  const dupes = useMemo(() => {
    const e = normalizeEmail(email);
    const p = digits(phone);
    const n = norm(name);
    return CLIENTS.filter(
      (c) =>
        (e.length > 4 && c.email.toLowerCase() === e) ||
        (p.length === 10 && digits(c.phone) === p) ||
        (n.length >= 4 && norm(c.name).includes(n)) ||
        (digits(ein).length === 9 && c.business?.einLast4 === digits(ein).slice(-4)),
    ).slice(0, 3);
  }, [CLIENTS, email, phone, name, ein]);

  const errors = {
    name: !name.trim() ? "Name is required" : null,
    email: validateEmail(email, true),
    phone: validatePhone(phone, false),
    address: Object.keys(validateAddress(address, false)).length > 0 ? "address" : null,
    dob: type === "individual" && !deferTax ? validateDOB(dob, taxRequired) : null,
    taxId: type === "individual" && !deferTax ? validateTaxId(taxId, taxIdType, taxRequired) : null,
    ein: type === "business" && !deferTax ? validateEIN(ein, taxRequired) : null,
    rpName: type === "business" && !deferTax && taxRequired && !rpName.trim() ? "Responsible party name is required" : null,
    rpTaxId: type === "business" && !deferTax ? validateTaxId(rpTaxId, rpTaxIdType, taxRequired) : null,
    services: services.length === 0 ? "Choose at least one service" : null,
  };
  const valid = Object.values(errors).every((x) => !x);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) {
      toast("Please fix the highlighted fields", "info");
      return;
    }
    const keepTax = !deferTax;
    const id = store.addClient({
      type,
      name,
      contactName: contact,
      entityType: entity,
      email: normalizeEmail(email),
      phone,
      address: { ...address, line2: address.line2 || undefined },
      dob: keepTax && dob ? dobToIso(dob) ?? undefined : undefined,
      taxIdType,
      taxId: keepTax && taxId ? taxId : undefined,
      ein: keepTax && ein ? ein : undefined,
      responsibleParty: type === "business" && rpName.trim() ? { name: rpName, title: rpTitle, taxIdType: rpTaxIdType, taxId: keepTax && rpTaxId ? rpTaxId : undefined } : undefined,
      services,
      staffIds: staff,
      invite,
    });
    if (services.includes("tax") && deferTax) {
      store.requestDocument(id, {
        name: type === "business" ? "EIN confirmation (CP 575 or 147C)" : "Taxpayer ID + date of birth (secure form)",
        service: "tax",
        category: "Tax ID",
        sensitive: true,
      });
    }
    toast(`${name.trim()} created${invite ? " — portal invitation sent" : ""}`);
    router.push(`/clients/${id}`);
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Client details" />
          <div className="space-y-4 px-5 pb-5 sm:px-6">
            <div role="radiogroup" aria-label="Client type" className="grid grid-cols-2 gap-2">
              {(
                [
                  ["individual", "Individual", User],
                  ["business", "Business", Building2],
                ] as const
              ).map(([v, l, Icon]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={type === v}
                  onClick={() => setType(v)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-[14px] font-medium ${type === v ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}
                >
                  <Icon size={18} /> {l}
                </button>
              ))}
            </div>
            <div>
              <TextField
                label={type === "business" ? "Business name" : "Full legal name"}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setName((n) => n.replace(/\s+/g, " ").trim())}
                placeholder={type === "business" ? "e.g. Sample Ventures LLC" : "As it appears on their tax return"}
                autoComplete={type === "business" ? "organization" : "name"}
                aria-invalid={submitted && !!errors.name}
              />
              {submitted && errors.name && <p className="mt-1 text-[12px] text-danger-ink">{errors.name}</p>}
            </div>
            {type === "business" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Primary contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact person's name" />
                <SelectField label="Entity type" value={entity} onChange={(e) => setEntity(e.target.value as Entity)} options={["LLC", "S-Corp", "C-Corp", "Sole Prop", "Partnership", "Nonprofit"].map((v) => [v, v])} />
              </div>
            )}
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <EmailInput id="nc-email" label="Email" required value={email} onChange={setEmail} showErrors={submitted} />
              <PhoneInput id="nc-phone" label="Phone" value={phone} onChange={setPhone} showErrors={submitted} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={type === "business" ? "Business address" : "Mailing address"} subtitle="Used on tax returns, filings and invoices" />
          <div className="px-5 pb-5 sm:px-6">
            <AddressFields idPrefix="nc-addr" value={address} onChange={setAddress} showErrors={submitted} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Tax identification"
            subtitle={type === "business" ? "EIN and the IRS responsible party" : "Date of birth and Social Security or Individual Taxpayer ID"}
            action={
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-muted ring-1 ring-line">
                <Lock size={11} /> Encrypted · masked after saving
              </span>
            }
          />
          <div className="space-y-4 px-5 pb-5 sm:px-6">
            {deferTax ? (
              <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-muted ring-1 ring-line">A secure request will be added to the client&rsquo;s portal checklist instead.</p>
            ) : type === "individual" ? (
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                <DOBInput id="nc-dob" label="Date of birth" required={taxRequired} value={dob} onChange={setDob} showErrors={submitted} />
                <TaxIdInput id="nc-taxid" label={taxIdType} required={taxRequired} value={taxId} onChange={setTaxId} type={taxIdType} onTypeChange={setTaxIdType} showErrors={submitted} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  <EINInput id="nc-ein" label="EIN" required={taxRequired} value={ein} onChange={setEin} showErrors={submitted} />
                </div>
                <ResponsiblePartyFields
                  idPrefix="nc-rp"
                  required={taxRequired}
                  name={rpName}
                  onName={setRpName}
                  title={rpTitle}
                  onTitle={setRpTitle}
                  taxId={rpTaxId}
                  onTaxId={setRpTaxId}
                  taxIdType={rpTaxIdType}
                  onTaxIdType={setRpTaxIdType}
                  showErrors={submitted}
                  onCopyContact={contact.trim() ? () => setRpName(contact.trim()) : undefined}
                />
              </div>
            )}
            {services.includes("tax") ? (
              <Checkbox label="Client will provide this in the portal" hint="Skips these fields now and adds a secure request to their checklist." checked={deferTax} onChange={() => setDeferTax((v) => !v)} />
            ) : (
              <p className="text-[12.5px] text-muted">Optional unless the client is enrolled in Tax Preparation.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Services" subtitle="Pick one or more — they all attach to this single client record" />
          <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2 sm:px-6">
            {SERVICE_ORDER.map((s) => {
              const on = services.includes(s);
              return (
                <label key={s} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${on ? "border-accent bg-accent-soft/60" : "border-line hover:bg-surface-hover"}`}>
                  <input type="checkbox" checked={on} onChange={() => setServices((x) => toggle(x, s))} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="h-6 w-1.5 rounded-full" style={{ background: `var(--svc-${s})` }} />
                  <span className="text-[14px] font-medium text-ink">{SERVICES[s].label}</span>
                </label>
              );
            })}
            {submitted && errors.services && <p className="text-[12px] text-danger-ink sm:col-span-2">{errors.services}</p>}
          </div>
        </Card>
      </div>

      <div className="space-y-5 xl:sticky xl:top-[96px] xl:self-start">
        {dupes.length > 0 && (
          <div role="alert" className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-warning-ink">
              <AlertTriangle size={17} /> Possible existing client
            </div>
            <p className="mt-1 text-[13px] text-ink-2">To avoid a duplicate record, add a new service to the existing client instead.</p>
            <ul className="mt-3 space-y-2">
              {dupes.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}#services`} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 hover:border-accent">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
                      <span className="block truncate text-[12px] text-muted">{c.email}</span>
                    </span>
                    <span className="flex gap-1">
                      {[...new Set(c.enrollments.map((e) => e.service))].map((s) => (
                        <ServiceTag key={s} service={s} short />
                      ))}
                    </span>
                    <ArrowRight size={15} className="text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card>
          <CardHeader title="Assignment & access" />
          <div className="space-y-4 px-5 pb-5 sm:px-6">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-2">Assigned staff</legend>
              <div className="flex flex-wrap gap-2">
                {STAFF.map((s) => {
                  const on = staff.includes(s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => setStaff((x) => toggle(x, s.id))} className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Checkbox label="Send client portal invitation" hint="Client sets their own password and multi-factor authentication." checked={invite} onChange={() => setInvite((v) => !v)} />
            <Button variant="primary" className="w-full" type="submit">
              Create client
            </Button>
            <p className="flex items-start gap-1.5 text-[12px] text-muted">
              <ShieldCheck size={13} className="mt-px shrink-0" /> SSN, ITIN and EIN are stored separately from the client record and only shown masked. Full numbers require a logged reveal.
            </p>
          </div>
        </Card>
      </div>
    </form>
  );
}
