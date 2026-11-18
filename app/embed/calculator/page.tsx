import type { Metadata } from "next";
import { headers } from "next/headers";
import { FullCalculator, type LeadCaptureConfig } from "@/components/calculator/FullCalculator";
import { FULL_TAX_YEAR } from "@/lib/calculator/full";
import { getEnv } from "@/lib/server/core";
import { decideEmbed, EMBED_MESSAGES, hostFromHeader } from "@/lib/server/calc-embed";
import { issueEmbedToken, leadCapture, noteSeen } from "@/lib/server/calculator";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Tax Calculator" }, description: "Estimate your federal income tax.", robots: { index: false, follow: false } };

const Msg = ({ children }: { children: React.ReactNode }) => (
  <main style={{ padding: 24, fontFamily: "Arial, Helvetica, sans-serif", color: "#3a3830", background: "#f6f4ee" }}><p style={{ margin: 0, fontSize: 14 }}>{children}</p></main>
);

/**
 * The licensed Monarch tax calculator, shown inside a customer's website. The middleware sends a per-license
 * frame-ancestors policy so browsers only render it inside that license's authorized websites.
 */
export default async function EmbeddedCalculatorPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const h = await headers();
  // Opened directly in a browser tab (not inside the customer's website): refuse.
  if (h.get("sec-fetch-dest")?.toLowerCase() === "document") return <Msg>This calculator can only be displayed on its authorized website.</Msg>;
  const env = await getEnv();
  const host = hostFromHeader(h.get("referer"));
  const d = await decideEmbed(env.DB, id ?? null, host).catch(() => null);
  if (!d) return <Msg>The calculator is unavailable right now. Please try again shortly.</Msg>;
  if (!d.ok) return <Msg>{EMBED_MESSAGES[d.reason]}</Msg>;
  if (!d.years.includes(FULL_TAX_YEAR)) return <Msg>This license does not include the {FULL_TAX_YEAR} tax year. Please contact Monarch Tax Suite.</Msg>;
  await noteSeen(env, d.licenseId, host);
  let lead: LeadCaptureConfig | undefined;
  try {
    const s = await leadCapture(env, d.licenseId);
    if (s) lead = { token: await issueEmbedToken(env, d.licenseId, host), businessName: s.business_name, includeSummary: !!s.include_summary };
  } catch { lead = undefined; }
  return <div style={{ background: "#fff", minHeight: "100vh" }}><FullCalculator leadCapture={lead} /></div>;
}
