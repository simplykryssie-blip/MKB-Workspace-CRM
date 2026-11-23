"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/lib/store/clients-store";
import { useTax } from "@/lib/store/tax-store";
import type { Client, ClientDocument } from "@/lib/types";

const YEARS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

/** Correct an uploaded file's name, tax year or category (the file itself doesn't change). */
export function RenameDocDialog({ c, doc, open, onClose }: { c: Client; doc: ClientDocument | null; open: boolean; onClose: () => void }) {
  const store = useClients();
  const toast = useToast();
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => { if (open && doc) { setName(doc.name); setYear(doc.taxYear ? String(doc.taxYear) : ""); setCategory(doc.category); } }, [open, doc]);
  if (!doc) return null;
  const valid = name.trim().length >= 2;
  const save = () => {
    store.updateDocument(c.id, doc.id, { name, category, taxYear: year ? Number(year) : null });
    toast("Document details saved");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Rename / edit details" description="Fix the name, tax year or category of this file. The file itself doesn't change." footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <TextField id="dr-name" label="Document name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2024 extension (Form 4868)" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="dr-year" label="Tax year" value={year} onChange={(e) => setYear(e.target.value)} options={[["", "None"], ...YEARS.map((y) => [String(y), String(y)] as [string, string])]} />
          <TextField id="dr-cat" label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

/**
 * The client uploaded the wrong file, or one we can't read. A different document is kept under what it
 * really is and the original request goes back to the client; an unreadable one is re-requested as is.
 * Either way the client gets a portal message and sees the note on the request.
 */
export function WrongDocDialog({ c, doc, open, onClose }: { c: Client; doc: ClientDocument | null; open: boolean; onClose: () => void }) {
  const store = useClients();
  const tax = useTax();
  const toast = useToast();
  const [kind, setKind] = useState<"different" | "unreadable">("different");
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(true);
  useEffect(() => { if (open) { setKind("different"); setActual(""); setNote(""); setMsg(true); } }, [open]);
  if (!doc) return null;
  const valid = kind === "unreadable" ? note.trim().length >= 3 : actual.trim().length >= 2;
  const save = () => {
    const openId = store.wrongDocument(c.id, doc, { kind, actualName: actual, note });
    if (kind === "different") tax.relinkDoc(c.id, doc.id, openId);
    if (msg) store.sendMessage(c.id, kind === "different"
      ? `Thanks for your upload! The file you sent for "${doc.name}" is your ${actual.trim()} — we've kept it in your files. We still need "${doc.name}".${note.trim() ? ` ${note.trim()}` : ""} Please upload it in your client portal under Documents.`
      : `We need "${doc.name}" again.${note.trim() ? ` ${note.trim()}` : ""} Please upload it in your client portal under Documents. Thank you!`, doc.service);
    toast(kind === "different" ? `Kept as "${actual.trim()}" — "${doc.name}" requested again` : `Asked the client to re-upload "${doc.name}"`);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Wrong or unreadable file" description={`For the request "${doc.name}".`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={save}>{kind === "different" ? "Keep it and ask again" : "Ask for a new copy"}</Button></>}>
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-[13px] font-medium text-ink-2">What's wrong with it?</legend>
          {([["different", "It's a different document", "e.g. they sent their extension instead of their original return. It's kept in their files under its real name."], ["unreadable", "It's the right document but unreadable or incomplete", "Blurry, cut off, missing pages… The same request is reopened."]] as const).map(([k, l, h]) => (
            <label key={k} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-[13.5px] ${kind === k ? "border-accent bg-accent-soft/40" : "border-line"}`}>
              <input type="radio" name="wd-kind" checked={kind === k} onChange={() => setKind(k)} className="mt-0.5 accent-[var(--accent)]" />
              <span><b>{l}</b><span className="block text-muted">{h}</span></span>
            </label>
          ))}
        </fieldset>
        {kind === "different" && <TextField id="wd-actual" label="What is the file actually?" value={actual} onChange={(e) => setActual(e.target.value)} placeholder={`e.g. ${doc.taxYear ? `${doc.taxYear} ` : ""}extension (Form 4868)`} />}
        <TextArea id="wd-note" label={kind === "unreadable" ? "What's wrong (shown to the client)" : "Note to the client (optional)"} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "unreadable" ? "e.g. Page 2 is missing — please upload all pages." : "e.g. Please upload the 2024 Form 1040 you filed in April."} />
        <label className="flex items-center gap-2 text-[13.5px] text-ink-2"><input type="checkbox" checked={msg} onChange={(e) => setMsg(e.target.checked)} className="accent-[var(--accent)]" /> Send the client a portal message about it</label>
      </div>
    </Modal>
  );
}
