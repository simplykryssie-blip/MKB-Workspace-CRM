import type { Metadata } from "next";
import { FullCalculator } from "@/components/calculator/FullCalculator";
import { WidgetShell } from "@/components/site/WidgetShell";
import { FULL_TAX_YEAR } from "@/lib/calculator/full";

export const metadata: Metadata = { title: "Tax Calculator", robots: { index: false, follow: false } };

/**
 * MKB's own free tax calculator inside a website page: <div data-mkb-widget="calculator"></div>.
 * Open to everyone — no contact details needed to see an estimate.
 */
export default function Page() {
  return (
    <WidgetShell>
      <div style={{ background: "#fff", borderRadius: 18, padding: "8px 0" }}>
        <p style={{ margin: "8px 18px 0", fontFamily: "Inter, Arial, sans-serif", fontSize: 13, color: "#5b574c" }}>
          {FULL_TAX_YEAR} federal tax year · estimate only
        </p>
        <FullCalculator />
        <p style={{ margin: "4px 18px 14px", fontFamily: "Inter, Arial, sans-serif", fontSize: 12.5, lineHeight: 1.55, color: "#6b665a" }}>
          This calculator gives a rough federal estimate for the {FULL_TAX_YEAR} tax year based only on what you enter. It is not tax advice and not a filed return — your actual refund or balance due depends on your full tax situation, state taxes and IRS processing.
        </p>
      </div>
    </WidgetShell>
  );
}
