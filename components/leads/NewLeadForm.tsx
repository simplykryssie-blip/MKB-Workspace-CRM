"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/lib/store/clients-store";
import { useLeads } from "@/lib/store/leads-store";
import { digits, normalizeEmail } from "@/lib/validation";
import { LeadFormFields, formToLead, leadFormErrors, leadToForm } from "./LeadDialogs";

export function NewLeadForm() {
  const store = useLeads();
  const { clients } = useClients();
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(() => leadToForm(undefined, { stageId: store.stages[0]?.id ?? "", source: store.sources[0] ?? "Website" }));
  const [submitted, setSubmitted] = useState(false);

  // Possible duplicates: existing open lead or client with same email/phone.
  const e = normalizeEmail(f.email);
  const p = digits(f.phone);
  const same = (email: string, phone: string) => (e.length > 4 && email.toLowerCase() === e) || (p.length === 10 && digits(phone) === p);
  const dupLeads = store.leads.filter((l) => same(l.email, l.phone)).slice(0, 2);
  const dupClients = clients.filter((c) => same(c.email, c.phone)).slice(0, 2);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (Object.values(leadFormErrors(f)).some(Boolean)) {
      toast("Please fix the highlighted fields", "info");
      return;
    }
    const id = store.addLead(formToLead(f));
    toast(`Lead "${f.name.trim()}" added`);
    router.push(`/leads/${id}`);
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card className="p-5 sm:p-6">
        <LeadFormFields f={f} set={(x) => setF((v) => ({ ...v, ...x }))} mode="new" submitted={submitted} />
      </Card>
      <div className="space-y-4 xl:sticky xl:top-[96px] xl:self-start">
        {(dupLeads.length > 0 || dupClients.length > 0) && (
          <div role="alert" className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-warning-ink"><AlertTriangle size={17} /> Already in the system</div>
            <ul className="mt-2 space-y-2">
              {dupClients.map((c) => (
                <li key={c.id}><Link href={`/clients/${c.id}#services`} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 text-[13px] hover:border-accent"><span className="flex-1"><b className="text-ink">{c.name}</b> <span className="text-muted">— existing client</span></span><ArrowRight size={14} className="text-accent" /></Link></li>
              ))}
              {dupLeads.map((l) => (
                <li key={l.id}><Link href={`/leads/${l.id}`} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 text-[13px] hover:border-accent"><span className="flex-1"><b className="text-ink">{l.name}</b> <span className="text-muted">— {l.status} lead</span></span><ArrowRight size={14} className="text-accent" /></Link></li>
              ))}
            </ul>
          </div>
        )}
        <Card className="space-y-3 p-5">
          <p className="text-[13px] text-muted">Leads track prospects until they become clients. When you convert, everything here carries over — nothing is re-entered.</p>
          <Button type="submit" variant="primary" className="w-full">Add lead</Button>
          <Button href="/leads" className="w-full">Cancel</Button>
        </Card>
      </div>
    </form>
  );
}
