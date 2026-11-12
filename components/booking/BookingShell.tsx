import { WidgetShell } from "@/components/site/WidgetShell";

/**
 * Inside a website page (embed) the booking calendar sits in a self-sizing
 * frame; opened on its own (a link in an email or text) it gets a branded page.
 */
export function BookingShell({ brand, embed, children }: { brand: "mkb" | "monarch"; embed: boolean; children: React.ReactNode }) {
  if (embed) return <WidgetShell>{children}</WidgetShell>;
  const m = brand === "monarch";
  return (
    <div style={{ minHeight: "100vh", background: "#eceae4", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ background: "#0b0b0b", padding: "14px 16px" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 720, margin: "0 auto", textDecoration: "none" }}>
          {m ? <img src="/brand/monarch-email.png" alt="Monarch Tax Suite" style={{ height: 40, width: "auto" }} />
            : <><img src="/brand/mkb-seal-192.png" alt="" width={44} height={44} /><span><span style={{ display: "block", font: "600 17px Georgia, serif", color: "#fff" }}>MKB Financial Group</span><span style={{ display: "block", fontSize: 10, letterSpacing: 3, color: "#f6d37a", fontWeight: 700 }}>STRATEGY • GROWTH • LEGACY</span></span></>}
        </a>
      </header>
      <div style={{ height: 4, background: "linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)" }} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>{children}</main>
    </div>
  );
}
