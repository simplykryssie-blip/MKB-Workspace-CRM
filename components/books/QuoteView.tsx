import type { BooksQuote } from "@/lib/fees/config";
import { money } from "@/lib/fees/config";

/** The client's bookkeeping quote: plan, extras, add-ons, one-time and custom-quoted work. */
export function QuoteView({ quote, accounts }: { quote: BooksQuote; accounts: number }) {
  const p = quote.plan;
  const line = (l: BooksQuote["monthly"][number]) => (l.billing === "quote" ? "Custom quote" : `${l.startingAt ? "from " : ""}${money(l.amount)}`);
  return (
    <div className="mt-3 rounded-xl border border-accent/30 bg-accent-soft/30 p-3.5">
      <p className="text-[13.5px] text-ink">Recommended plan: <b>{p.key}</b> — up to {p.transactions.toLocaleString()} transactions, {p.accounts} accounts, {p.locations} location{p.locations === 1 ? "" : "s"} ({accounts} account{accounts === 1 ? "" : "s"} listed).</p>
      <table className="mt-2 w-full text-[13px]">
        <tbody>
          {quote.monthly.map((l) => <tr key={l.label}><td className="py-0.5 text-ink-2">{l.label}</td><td className="py-0.5 text-right tabular-nums">{line(l)}/mo</td></tr>)}
          <tr className="border-t border-line font-semibold"><td className="py-1">Monthly total</td><td className="py-1 text-right tabular-nums">{quote.monthly.some((l) => l.startingAt) ? "from " : ""}{money(quote.monthlyTotal)}/mo</td></tr>
          {quote.oneTime.map((l) => <tr key={l.label}><td className="py-0.5 text-ink-2">{l.label} <span className="text-muted">(one-time)</span></td><td className="py-0.5 text-right tabular-nums">{line(l)}</td></tr>)}
          {quote.quoted.map((l) => <tr key={l.label}><td className="py-0.5 text-ink-2">{l.label}</td><td className="py-0.5 text-right text-muted">Custom quote</td></tr>)}
        </tbody>
      </table>
      {!!quote.notes?.length && <ul className="mt-2 space-y-1 border-t border-line pt-2">{quote.notes.map((n) => <li key={n} className="text-[12.5px] text-muted">• {n}</li>)}</ul>}
    </div>
  );
}
