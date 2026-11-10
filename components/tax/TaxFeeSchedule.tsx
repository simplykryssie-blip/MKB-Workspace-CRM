"use client";

import { useState } from "react";
import { Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useTax } from "@/lib/store/tax-store";
import { usd } from "@/lib/format";
import { NoAccess } from "./TaxBits";

/** The tax preparation fee schedule (Settings → Fees). Changes save as you make them. */
export function TaxFeeSchedule() {
  const tax = useTax();
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<"individual" | "business" | "both">("both");
  const can = tax.access.billing;
  return (
    <div className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Tags size={16} className="text-accent" />
        <span className="text-[14px] font-semibold text-ink">Return price list</span>
        <span className="text-[12.5px] text-muted">Used to build each return&rsquo;s price. Changes save as you make them and don&rsquo;t alter returns already priced.</span>
      </div>
      {!can && <div className="mx-4 mb-3"><NoAccess what="Editing prices" /></div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13.5px]">
          <thead className="border-y border-line bg-surface-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-2.5">Item</th><th className="px-3 py-2.5">Applies to</th><th className="px-3 py-2.5 text-right">Price</th><th className="w-12 px-5 py-2.5" /></tr>
          </thead>
          <tbody>
            {tax.fees.map((f) => (
              <tr key={f.code} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5"><span className="font-medium text-ink">{f.label}</span>{f.unit && <span className="ml-1 text-[12px] text-muted">({f.unit})</span>}</td>
                <td className="px-3 py-2.5 capitalize text-ink-2">{f.kind === "both" ? "All" : f.kind}</td>
                <td className="px-3 py-2.5 text-right">
                  <label className="inline-flex items-center gap-1">
                    <span className="text-muted">$</span>
                    <input aria-label={`Price for ${f.label}`} type="number" min={0} disabled={!can} defaultValue={f.price} onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== f.price) { tax.setFee(f.code, v); toast(`${f.label}: ${usd(v)}`); } }} className="h-8 w-24 rounded-lg border border-line bg-surface px-2 text-right tabular-nums text-ink disabled:opacity-60" />
                  </label>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button aria-label={`Remove ${f.label}`} disabled={!can} onClick={() => { tax.removeFee(f.code); toast(`Removed ${f.label}`); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-danger disabled:opacity-30"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim() || !(Number(price) >= 0) || price === "") return;
          tax.addFee({ code: `C-${Date.now().toString(36)}`, label: label.trim(), kind, price: Number(price) });
          toast(`Added "${label.trim()}"`);
          setLabel("");
          setPrice("");
        }}
        className="flex flex-wrap items-end gap-2 border-t border-line p-4"
      >
        <input aria-label="New fee item" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New item, e.g. Schedule F — farm income" disabled={!can} className="h-10 min-w-[220px] flex-1 rounded-xl border border-line bg-surface px-3 text-[14px] text-ink disabled:opacity-60" />
        <select aria-label="Applies to" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} disabled={!can} className="h-10 rounded-xl border border-line bg-surface px-2 text-[13.5px] text-ink-2"><option value="both">All</option><option value="individual">Individual</option><option value="business">Business</option></select>
        <input aria-label="New fee price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" disabled={!can} className="h-10 w-28 rounded-xl border border-line bg-surface px-3 text-right text-[14px] text-ink disabled:opacity-60" />
        <Button type="submit" icon={Plus} disabled={!can || !label.trim() || price === ""}>Add</Button>
      </form>
    </div>
  );
}
