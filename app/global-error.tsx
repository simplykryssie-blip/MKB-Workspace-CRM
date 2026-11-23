"use client";

import { useEffect } from "react";
import { reportError } from "@/components/system/report-error";

/** Last resort when the whole app fails to load: a plain page with a Reload button (instead of a blank "Application error"). */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportError(error); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Arial, sans-serif", background: "#f6f7f9", color: "#1d2433" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
          <div style={{ maxWidth: 440 }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#5b6475" }}>It&rsquo;s been reported so it can be fixed. Please reload the page. If it keeps happening, try another browser or update this one.</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: "10px 18px", borderRadius: 12, border: 0, background: "#1f6feb", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Reload page</button>
            {error?.message && <p style={{ marginTop: 16, fontSize: 12, color: "#8a93a3", wordBreak: "break-word" }}>Details: {error.message.slice(0, 200)}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
